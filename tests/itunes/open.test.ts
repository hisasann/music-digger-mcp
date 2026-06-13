import { describe, it, expect, vi } from 'vitest';
import { openAppleMusicUrl } from '../../src/itunes/open.js';

describe('openAppleMusicUrl', () => {
  it('runs `open -a Music <url>` so Music.app handles the page (not the browser)', async () => {
    const runner = vi.fn(async () => 0);
    await openAppleMusicUrl('https://music.apple.com/jp/x', runner);
    expect(runner).toHaveBeenCalledWith('open', ['-a', 'Music', 'https://music.apple.com/jp/x']);
  });

  it('throws when open exits non-zero', async () => {
    const runner = vi.fn(async () => 1);
    await expect(openAppleMusicUrl('https://...', runner)).rejects.toThrow(/exit/i);
  });
});
