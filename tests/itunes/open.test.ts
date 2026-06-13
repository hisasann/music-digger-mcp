import { describe, it, expect, vi } from 'vitest';
import { openAppleMusicUrl } from '../../src/itunes/open.js';

describe('openAppleMusicUrl', () => {
  it('uses osascript `open location` so Music.app starts playback in one step', async () => {
    const runner = vi.fn(async () => 0);
    await openAppleMusicUrl('https://music.apple.com/jp/x', runner);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith('osascript', [
      '-e',
      'tell application "Music" to open location "https://music.apple.com/jp/x"',
    ]);
  });

  it('escapes embedded quotes and backslashes in the URL for AppleScript', async () => {
    const runner = vi.fn(async () => 0);
    await openAppleMusicUrl('https://music.apple.com/jp/album/"foo"\\bar', runner);
    const script = (runner.mock.calls[0][1] as string[])[1];
    expect(script).toContain('\\"foo\\"');
    expect(script).toContain('\\\\bar');
  });

  it('throws when osascript exits non-zero', async () => {
    const runner = vi.fn(async () => 1);
    await expect(openAppleMusicUrl('https://...', runner)).rejects.toThrow(/exit/i);
  });
});
