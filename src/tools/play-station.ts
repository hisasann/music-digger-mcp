import { playStationFromSeed } from '../applescript/play.js';
import type { Config } from '../config.js';
import { readStationSeeds, pickRandomSeed } from '../obsidian/stations.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlayStationInput { seed?: string; }
export type PlayStationOutput =
  | { playing: true; seed: string; starting_track: { artist: string; album: string; track: string } }
  | { playing: false; reason: 'not_found' | 'no_seeds' }
  | ToolError;

export interface PlayStationDeps extends ToolDeps {
  cfg: Config;
  rng?: () => number;
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
    const r = await playStationFromSeed(deps.runner, seed);
    if (r.ok) return { playing: true, seed: r.seed, starting_track: r.starting_track };
    return { playing: false, reason: r.reason };
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
