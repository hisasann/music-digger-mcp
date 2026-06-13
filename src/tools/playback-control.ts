import type { AppleScriptRunner } from '../applescript/runner.js';
import { sendPlaybackAction, type PlaybackAction } from '../applescript/control.js';
import type { ToolError } from './current-track.js';

export interface PlaybackControlDeps { runner: AppleScriptRunner; }
export interface PlaybackControlInput { action: PlaybackAction; }
export type PlaybackControlOutput =
  | { ok: true; state: 'playing' | 'paused' | 'stopped'; repeat_mode: 'off' | 'one' | 'all' }
  | ToolError;

/**
 * Apple Music / Music.app driven playback control. Not wired into the MCP
 * tool list under the current YouTube-based pivot — retained so it can be
 * brought back when Music.app is needed again (e.g. for the "add liked
 * YouTube finds back to the Apple Music library" workflow).
 */
export async function handlePlaybackControl(
  deps: PlaybackControlDeps,
  input: PlaybackControlInput,
): Promise<PlaybackControlOutput> {
  try {
    return await sendPlaybackAction(deps.runner, input.action);
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
