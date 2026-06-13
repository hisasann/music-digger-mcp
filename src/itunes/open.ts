import { runCommand, type CommandRunner } from '../youtube/open.js';

export async function openAppleMusicUrl(
  url: string,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const code = await runner('open', [url]);
  if (code !== 0) throw new Error(`open exited with code ${code}`);
}
