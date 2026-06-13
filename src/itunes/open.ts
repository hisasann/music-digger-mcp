import { runCommand, type CommandRunner } from '../youtube/open.js';

export type Sleeper = (ms: number) => Promise<void>;

const defaultSleep: Sleeper = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Open an Apple Music page directly in Music.app (not the browser).
 * `open -a Music <url>` forces Music.app even though the URL host is
 * music.apple.com (which would otherwise resolve to the default browser).
 *
 * `open` only navigates Music.app to the page — it does not start playback.
 * After navigation settles, we send Music.app a `play` command via
 * osascript so the user actually hears something. The 600ms gap lets the
 * page render and updates `current track`; firing `play` too early replays
 * whatever track was previously loaded.
 */
export async function openAppleMusicUrl(
  url: string,
  runner: CommandRunner = runCommand,
  sleep: Sleeper = defaultSleep,
): Promise<void> {
  const openCode = await runner('open', ['-a', 'Music', url]);
  if (openCode !== 0) throw new Error(`open exited with code ${openCode}`);
  await sleep(600);
  const playCode = await runner('osascript', ['-e', 'tell application "Music" to play']);
  if (playCode !== 0) throw new Error(`osascript play exited with code ${playCode}`);
}
