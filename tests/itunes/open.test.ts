import { describe, it, expect, vi } from 'vitest';
import { openAppleMusicUrl } from '../../src/itunes/open.js';

describe('openAppleMusicUrl', () => {
  it('opens the URL in Music.app, waits, then triggers play via osascript', async () => {
    const runner = vi.fn(async () => 0);
    const sleep = vi.fn(async () => {});
    await openAppleMusicUrl('https://music.apple.com/jp/x', runner, sleep);
    expect(runner).toHaveBeenNthCalledWith(1, 'open', ['-a', 'Music', 'https://music.apple.com/jp/x']);
    expect(sleep).toHaveBeenCalledWith(600);
    expect(runner).toHaveBeenNthCalledWith(2, 'osascript', ['-e', 'tell application "Music" to play']);
  });

  it('throws when the open step fails (and never tries to play)', async () => {
    const runner = vi.fn(async () => 1);
    const sleep = vi.fn(async () => {});
    await expect(openAppleMusicUrl('https://...', runner, sleep)).rejects.toThrow(/open exited/i);
    expect(sleep).not.toHaveBeenCalled();
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('throws when the play step fails', async () => {
    const calls: number[] = [];
    const runner = vi.fn(async () => { calls.push(calls.length); return calls.length === 2 ? 1 : 0; });
    const sleep = vi.fn(async () => {});
    await expect(openAppleMusicUrl('https://...', runner, sleep)).rejects.toThrow(/play exited/i);
    expect(runner).toHaveBeenCalledTimes(2);
  });
});
