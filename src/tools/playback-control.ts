import { sendPlaybackAction, type PlaybackAction } from '../applescript/control.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlaybackControlInput { action: PlaybackAction; }
export type PlaybackControlOutput =
  | { ok: true; state: 'playing' | 'paused' | 'stopped'; repeat_mode: 'off' | 'one' | 'all' }
  | ToolError;

export async function handlePlaybackControl(
  deps: ToolDeps,
  input: PlaybackControlInput,
): Promise<PlaybackControlOutput> {
  try {
    return await sendPlaybackAction(deps.runner, input.action);
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
