import { runCommand, type CommandRunner } from '../youtube/open.js';

/**
 * Navigate Music.app to an Apple Music URL.
 *
 * `open -a Music <url>` forces Music.app even when the URL host is
 * music.apple.com (which would otherwise resolve to the default browser).
 *
 * NOTE: Music.app does not auto-play catalog tracks from a URL — it only
 * navigates to the page. The user has to press the play / + button. This
 * is fine for the mark_current love handoff (the goal is to "show me
 * this on Apple Music so I can keep it"), but it is NOT a playback API.
 * For actual playback we use the YouTube/Safari path instead.
 */
export async function openAppleMusicUrl(
  url: string,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const code = await runner('open', ['-a', 'Music', url]);
  if (code !== 0) throw new Error(`open exited with code ${code}`);
}
