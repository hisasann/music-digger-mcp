import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../config.js';
import { getCurrentTrack } from '../applescript/current.js';
import { appendDiaryEntry, parseAlbumReactions, type Reaction } from '../obsidian/diary.js';
import { shouldPromote, upsertAlbumCard } from '../obsidian/album-card.js';
import { hasICloudPlaceholder } from '../obsidian/icloud.js';
import { resolveDiaryPath, resolveAlbumCardPath, ensureSubdirs } from '../obsidian/paths.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface MarkCurrentInput { reaction: Reaction; note?: string; }
export interface MarkCurrentClock { now: () => Date; }

export type MarkCurrentOutput =
  | { marked: false; reason: 'nothing_playing' }
  | { marked: false; reason: 'icloud_placeholder'; path: string }
  | { marked: true; diary_path: string; album_card_path?: string; promoted: boolean }
  | ToolError;

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

export async function handleMarkCurrent(
  deps: ToolDeps,
  cfg: Config,
  input: MarkCurrentInput,
  clock: MarkCurrentClock,
): Promise<MarkCurrentOutput> {
  let track;
  try {
    track = await getCurrentTrack(deps.runner);
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
  if (!track.artist || !track.album || !track.track) {
    return { marked: false, reason: 'nothing_playing' };
  }

  const now = clock.now();
  const isoToday = isoDate(now);
  const diaryTarget = resolveDiaryPath(cfg, isoToday);
  if (await hasICloudPlaceholder(diaryTarget)) {
    return { marked: false, reason: 'icloud_placeholder', path: diaryTarget };
  }
  const albumTarget = resolveAlbumCardPath(cfg, track.artist, track.album);
  if (await hasICloudPlaceholder(albumTarget)) {
    return { marked: false, reason: 'icloud_placeholder', path: albumTarget };
  }

  await ensureSubdirs(cfg);

  const diary_path = await appendDiaryEntry(cfg, {
    isoDate: isoToday,
    time: hhmm(now),
    artist: track.artist,
    album: track.album,
    track: track.track,
    reaction: input.reaction,
    note: input.note,
  });

  const diaries = await readAllDiaries(cfg);
  const counts = parseAlbumReactions(diaries, track.artist, track.album);

  if (shouldPromote(counts)) {
    const card_path = await upsertAlbumCard(cfg, {
      artist: track.artist,
      album: track.album,
      counts,
      isoDate: isoToday,
      noteLine: input.note,
    });
    return { marked: true, diary_path, album_card_path: card_path, promoted: true };
  }
  return { marked: true, diary_path, promoted: false };
}
