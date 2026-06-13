import { spawn } from 'node:child_process';

export type CommandRunner = (cmd: string, args: string[]) => Promise<number>;

export const runCommand: CommandRunner = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? -1));
  });

export function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export async function openInSafari(
  videoId: string,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const code = await runner('open', ['-a', 'Safari', videoUrl(videoId)]);
  if (code !== 0) throw new Error(`open exited with code ${code}`);
}
