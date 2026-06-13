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
  it('without previousVideoId: runs `open -a Safari <url>` to open a fresh tab', async () => {
    const runner = vi.fn(async () => 0);
    await openInSafari('Blg_vkaXSWI', runner);
    expect(runner).toHaveBeenCalledWith('open', [
      '-a',
      'Safari',
      'https://www.youtube.com/watch?v=Blg_vkaXSWI',
    ]);
  });

  it('with previousVideoId: runs an osascript that overwrites the matching tab in place', async () => {
    const runner = vi.fn(async () => 0);
    await openInSafari('NEW_ID', runner, { previousVideoId: 'OLD_ID' });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0][0]).toBe('osascript');
    const script = (runner.mock.calls[0][1] as string[])[1];
    expect(script).toContain('tell application "Safari"');
    expect(script).toContain('OLD_ID');
    expect(script).toContain('https://www.youtube.com/watch?v=NEW_ID');
    // Fallback path for when the previous tab was closed manually:
    expect(script).toContain('if not didReplace then open location');
  });

  it('throws when the open command exits non-zero', async () => {
    const runner = vi.fn(async () => 1);
    await expect(openInSafari('x', runner)).rejects.toThrow(/exit/i);
  });

  it('throws when the osascript replacement step fails', async () => {
    const runner = vi.fn(async () => 2);
    await expect(openInSafari('x', runner, { previousVideoId: 'y' })).rejects.toThrow(/exit/i);
  });
});
