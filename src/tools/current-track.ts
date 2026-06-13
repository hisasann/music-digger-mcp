import type { PlaybackStore, CurrentPlayback } from '../state.js';

export type ToolError = { ok: false; error: { code: string; message: string } };

export type CurrentTrackOutput =
  | { playing: true; current: CurrentPlayback }
  | { playing: false }
  | ToolError;

export interface CurrentTrackDeps {
  store: PlaybackStore;
}

export async function handleCurrentTrack(deps: CurrentTrackDeps): Promise<CurrentTrackOutput> {
  const current = deps.store.get();
  if (!current) return { playing: false };
  return { playing: true, current };
}
