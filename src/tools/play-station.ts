import type { Config } from '../config.js';
import { readStationSeeds, pickRandomSeed } from '../obsidian/stations.js';
import { searchYouTube, preferTopicChannel, type SearchDeps } from '../youtube/search.js';
import { openInSafari, videoUrl, type CommandRunner } from '../youtube/open.js';
import type { PlaybackStore } from '../state.js';

export interface PlayStationInput { seed?: string; }

export type PlayStationOutput =
  | {
      playing: true;
      seed: string;
      now_playing: { videoId: string; title: string; channel: string; url: string };
    }
  | { playing: false; reason: 'no_seeds' | 'search_empty' }
  | { ok: false; error: { code: string; message: string } };

export interface PlayStationDeps {
  cfg: Config;
  store: PlaybackStore;
  search?: SearchDeps;
  opener?: CommandRunner;
  rng?: () => number;
  now?: () => Date;
}

export async function handlePlayStation(
  deps: PlayStationDeps,
  input: PlayStationInput,
): Promise<PlayStationOutput> {
  try {
    let seed = input.seed;
    if (!seed) {
      const seeds = await readStationSeeds(deps.cfg);
      const picked = pickRandomSeed(seeds, deps.rng);
      if (!picked) return { playing: false, reason: 'no_seeds' };
      seed = picked;
    }

    const videos = await searchYouTube(seed, 8, deps.search);
    const chosen = preferTopicChannel(videos);
    if (!chosen) return { playing: false, reason: 'search_empty' };

    await openInSafari(chosen.videoId, deps.opener);

    const url = videoUrl(chosen.videoId);
    const now = (deps.now ?? (() => new Date()))();
    deps.store.set({
      videoId: chosen.videoId,
      title: chosen.title,
      channel: chosen.channel,
      url,
      sourceSeed: seed,
      startedAt: now.toISOString(),
    });

    return {
      playing: true,
      seed,
      now_playing: { videoId: chosen.videoId, title: chosen.title, channel: chosen.channel, url },
    };
  } catch (e) {
    return { ok: false, error: { code: 'youtube_unavailable', message: (e as Error).message } };
  }
}
