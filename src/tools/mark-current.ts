import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../config.js';
import { appendDiaryEntry, parseAlbumReactions, type Reaction } from '../obsidian/diary.js';
import { shouldPromote, upsertAlbumCard } from '../obsidian/album-card.js';
import { hasICloudPlaceholder } from '../obsidian/icloud.js';
import { resolveDiaryPath, resolveAlbumCardPath, ensureSubdirs } from '../obsidian/paths.js';
import { parseTrackTitle } from '../youtube/metadata.js';
import { searchItunesTrack, type ItunesSearchDeps } from '../itunes/search.js';
import { openAppleMusicUrl } from '../itunes/open.js';
import type { CommandRunner } from '../youtube/open.js';
import type { PlaybackStore } from '../state.js';
import type { ToolError } from './current-track.js';

export interface MarkCurrentInput {
  reaction: Reaction;
  note?: string;
  /** Optional override when YouTube title parsing comes out wrong. */
  artist?: string;
  /** Optional override when YouTube title parsing comes out wrong. */
  album?: string;
  /** Optional override when YouTube title parsing comes out wrong. */
  track?: string;
}
export interface MarkCurrentClock { now: () => Date; }

export type AppleMusicOpened =
  | { opened: true; url: string; matched_artist: string; matched_track: string }
  | { opened: false; reason: 'no_match' | 'search_failed' | 'skipped_reaction' };

export type MarkCurrentOutput =
  | { marked: false; reason: 'nothing_playing' }
  | { marked: false; reason: 'icloud_placeholder'; path: string }
  | {
      marked: true;
      diary_path: string;
      album_card_path?: string;
      promoted: boolean;
      apple_music: AppleMusicOpened;
    }
  | ToolError;

export interface MarkCurrentDeps {
  store: PlaybackStore;
  itunes?: ItunesSearchDeps;
  opener?: CommandRunner;
}

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function isoDate(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function hhmm(d: Date): string { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

async function readAllDiaries(cfg: Config): Promise<string[]> {
  const dir = join(cfg.vaultPath, cfg.diarySubdir);
  let names: string[] = [];
  try { names = await readdir(dir); } catch { return []; }
  const out: string[] = [];
  for (const n of names) {
    if (!n.endsWith('.md')) continue;
    try { out.push(await readFile(join(dir, n), 'utf8')); } catch { /* skip */ }
  }
  return out;
}

const POSITIVE_REACTIONS: Reaction[] = ['love', 'like'];

async function maybeOpenInAppleMusic(
  artist: string,
  track: string,
  reaction: Reaction,
  deps: MarkCurrentDeps,
): Promise<AppleMusicOpened> {
  if (!POSITIVE_REACTIONS.includes(reaction)) {
    return { opened: false, reason: 'skipped_reaction' };
  }
  let hit;
  try {
    hit = await searchItunesTrack(artist, track, deps.itunes);
  } catch {
    return { opened: false, reason: 'search_failed' };
  }
  if (!hit) return { opened: false, reason: 'no_match' };
  try {
    await openAppleMusicUrl(hit.trackViewUrl, deps.opener);
  } catch {
    return { opened: false, reason: 'search_failed' };
  }
  return {
    opened: true,
    url: hit.trackViewUrl,
    matched_artist: hit.artistName,
    matched_track: hit.trackName,
  };
}

export async function handleMarkCurrent(
  deps: MarkCurrentDeps,
  cfg: Config,
  input: MarkCurrentInput,
  clock: MarkCurrentClock,
): Promise<MarkCurrentOutput> {
  const current = deps.store.get();
  if (!current) return { marked: false, reason: 'nothing_playing' };

  const parsed = parseTrackTitle(current.title, current.channel);
  const artist = input.artist ?? parsed.artist;
  const album = input.album ?? parsed.album;
  const track = input.track ?? parsed.track;

  const now = clock.now();
  const isoToday = isoDate(now);
  const diaryTarget = resolveDiaryPath(cfg, isoToday);
  if (await hasICloudPlaceholder(diaryTarget)) {
    return { marked: false, reason: 'icloud_placeholder', path: diaryTarget };
  }
  const albumTarget = resolveAlbumCardPath(cfg, artist, album);
  if (await hasICloudPlaceholder(albumTarget)) {
    return { marked: false, reason: 'icloud_placeholder', path: albumTarget };
  }

  await ensureSubdirs(cfg);

  const diary_path = await appendDiaryEntry(cfg, {
    isoDate: isoToday,
    time: hhmm(now),
    artist,
    album,
    track,
    reaction: input.reaction,
    note: input.note,
  });

  const diaries = await readAllDiaries(cfg);
  const counts = parseAlbumReactions(diaries, artist, album);

  const apple_music = await maybeOpenInAppleMusic(artist, track, input.reaction, deps);

  if (shouldPromote(counts)) {
    const card_path = await upsertAlbumCard(cfg, {
      artist,
      album,
      counts,
      isoDate: isoToday,
      noteLine: input.note,
    });
    return { marked: true, diary_path, album_card_path: card_path, promoted: true, apple_music };
  }
  return { marked: true, diary_path, promoted: false, apple_music };
}
