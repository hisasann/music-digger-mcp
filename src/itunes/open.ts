import { runCommand, type CommandRunner } from '../youtube/open.js';

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Open an Apple Music URL in Music.app and start playback in one step.
 *
 * `Music.app` exposes an AppleScript `open location` command that both
 * navigates to the URL *and* starts playback. This avoids the two-step
 * race we used to have with `open -a Music <url>` followed by a
 * separate `play` command — the play would fire against whatever track
 * Music.app still had loaded (often the previously-paused song), so the
 * "wrong" track started.
 */
export async function openAppleMusicUrl(
  url: string,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const script = `tell application "Music" to open location "${escapeAppleScript(url)}"`;
  const code = await runner('osascript', ['-e', script]);
  if (code !== 0) throw new Error(`osascript exited with code ${code}`);
}
