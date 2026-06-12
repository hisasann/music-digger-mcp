import type { AppleScriptRunner } from '../applescript/runner.js';
import { getCurrentTrack, type CurrentTrack } from '../applescript/current.js';

export interface ToolDeps { runner: AppleScriptRunner; }
export type ToolError = { ok: false; error: { code: string; message: string } };

export async function handleCurrentTrack(deps: ToolDeps): Promise<CurrentTrack | ToolError> {
  try {
    return await getCurrentTrack(deps.runner);
  } catch (e) {
    return {
      ok: false,
      error: { code: 'music_app_unavailable', message: (e as Error).message },
    };
  }
}
