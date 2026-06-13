import { runCommand, type CommandRunner } from '../youtube/open.js';

/**
 * Open an Apple Music page directly in Music.app (not the browser).
 * `open -a Music <url>` forces Music.app even though the URL host is
 * music.apple.com (which would otherwise resolve to the default browser).
 */
export async function openAppleMusicUrl(
  url: string,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const code = await runner('open', ['-a', 'Music', url]);
  if (code !== 0) throw new Error(`open exited with code ${code}`);
}
