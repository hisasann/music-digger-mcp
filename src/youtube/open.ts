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

export interface OpenInSafariOptions {
  /**
   * If provided, look for a Safari tab whose URL contains this videoId
   * and overwrite that tab's URL instead of opening a fresh one. Falls
   * back to a new tab when the previous tab can't be found (the user
   * may have closed it manually).
   */
  previousVideoId?: string;
}

/**
 * Tabs accumulate fast if we always `open` a new URL — every play_station
 * call would leave a stranded YouTube tab. When the caller knows which
 * video was open last, AppleScript-drive Safari to overwrite that tab's
 * URL instead.
 */
export async function openInSafari(
  videoId: string,
  runner: CommandRunner = runCommand,
  options: OpenInSafariOptions = {},
): Promise<void> {
  const url = videoUrl(videoId);
  if (options.previousVideoId) {
    const script =
      `tell application "Safari"\n` +
      `  set didReplace to false\n` +
      `  repeat with w in windows\n` +
      `    repeat with t in tabs of w\n` +
      `      if URL of t contains "${options.previousVideoId}" then\n` +
      `        set URL of t to "${url}"\n` +
      `        set current tab of w to t\n` +
      `        set didReplace to true\n` +
      `        exit repeat\n` +
      `      end if\n` +
      `    end repeat\n` +
      `    if didReplace then exit repeat\n` +
      `  end repeat\n` +
      `  if not didReplace then open location "${url}"\n` +
      `end tell`;
    const code = await runner('osascript', ['-e', script]);
    if (code !== 0) throw new Error(`osascript exited with code ${code}`);
    return;
  }
  const code = await runner('open', ['-a', 'Safari', url]);
  if (code !== 0) throw new Error(`open exited with code ${code}`);
}
