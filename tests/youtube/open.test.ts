import { describe, it, expect, vi } from 'vitest';
import { openInSafari, videoUrl } from '../../src/youtube/open.js';

describe('videoUrl', () => {
  it('builds the canonical watch URL', () => {
    expect(videoUrl('Blg_vkaXSWI')).toBe('https://www.youtube.com/watch?v=Blg_vkaXSWI');
  });

  it('URL-encodes funky video ids defensively', () => {
    expect(videoUrl('a/b?c')).toBe('https://www.youtube.com/watch?v=a%2Fb%3Fc');
  });
});

describe('openInSafari', () => {
  it('runs `open -a Safari <url>`', async () => {
    const runner = vi.fn(async () => 0);
    await openInSafari('Blg_vkaXSWI', runner);
    expect(runner).toHaveBeenCalledWith('open', [
      '-a',
      'Safari',
      'https://www.youtube.com/watch?v=Blg_vkaXSWI',
    ]);
  });

  it('throws when the open command exits non-zero', async () => {
    const runner = vi.fn(async () => 1);
    await expect(openInSafari('x', runner)).rejects.toThrow(/exit/i);
  });
});
