import { describe, it, expect, vi } from 'vitest';
import { handlePlayAlbum } from '../../src/tools/play-album.js';

describe('handlePlayAlbum', () => {
  it('returns playing:true on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'ok\x1fMarvin Gaye\x1fWhat\'s Going On\x1fWhat\'s Going On'
    );
    const r = await handlePlayAlbum({ runner }, { artist: 'Marvin Gaye', album: "What's Going On" });
    expect(r).toEqual({
      playing: true,
      artist: 'Marvin Gaye',
      album: "What's Going On",
      first_track: "What's Going On",
    });
  });

  it('returns playing:false / not_found when AppleScript reports missing', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f');
    const r = await handlePlayAlbum({ runner }, { artist: 'X', album: 'Y' });
    expect(r).toEqual({ playing: false, reason: 'not_found' });
  });

  it('returns ok:false on AppleScript runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlayAlbum({ runner }, { artist: 'A', album: 'B' });
    expect((r as any).ok).toBe(false);
    expect((r as any).error.code).toBe('music_app_unavailable');
  });
});
