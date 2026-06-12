import { playStationFromSeed } from '../applescript/play.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlayStationInput { seed: string; }
export type PlayStationOutput =
  | { playing: true; seed: string; starting_track: { artist: string; album: string; track: string } }
  | { playing: false; reason: 'not_found' }
  | ToolError;

export async function handlePlayStation(
  deps: ToolDeps,
  input: PlayStationInput,
): Promise<PlayStationOutput> {
  try {
    const r = await playStationFromSeed(deps.runner, input.seed);
    if (r.ok) return { playing: true, seed: r.seed, starting_track: r.starting_track };
    return { playing: false, reason: r.reason };
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
