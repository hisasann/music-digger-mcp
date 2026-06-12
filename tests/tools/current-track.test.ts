import { describe, it, expect, vi } from 'vitest';
import { handleCurrentTrack } from '../../src/tools/current-track.js';

describe('handleCurrentTrack', () => {
  it('returns parsed track info on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'playing\x1fMarvin Gaye\x1fWhat\'s Going On\x1fInner City Blues\x1f10\x1f200'
    );
    const r = await handleCurrentTrack({ runner });
    expect('playing' in r && r.playing).toBe(true);
    expect('artist' in r && r.artist).toBe('Marvin Gaye');
  });

  it('returns ok:false with music_app_unavailable when runner throws', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('osascript boom'));
    const r = await handleCurrentTrack({ runner });
    expect(r).toEqual({
      ok: false,
      error: { code: 'music_app_unavailable', message: expect.any(String) },
    });
  });
});
