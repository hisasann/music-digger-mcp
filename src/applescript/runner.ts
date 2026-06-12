import { spawn } from 'node:child_process';

export class AppleScriptError extends Error {
  constructor(message: string, public stderr: string, public exitCode: number | null) {
    super(message);
    this.name = 'AppleScriptError';
  }
}

export type AppleScriptRunner = (script: string) => Promise<string>;

export const runAppleScript: AppleScriptRunner = (script) => {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new AppleScriptError(`osascript exited with code ${code}`, stderr.trim(), code));
      }
    });
  });
};
