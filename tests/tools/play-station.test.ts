import { describe, it, expect, vi } from 'vitest';
import { handlePlayStation } from '../../src/tools/play-station.js';

describe('handlePlayStation', () => {
  it('returns playing:true with starting_track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'ok\x1fMarvin Gaye\x1fWhat\'s Going On\x1fInner City Blues'
    );
    const r = await handlePlayStation({ runner }, { seed: 'Marvin Gaye' });
    expect(r).toEqual({
      playing: true,
      seed: 'Marvin Gaye',
      starting_track: {
        artist: 'Marvin Gaye',
        album: "What's Going On",
        track: 'Inner City Blues',
      },
    });
  });

  it('returns playing:false / not_found when seed missing', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f\x1f');
    const r = await handlePlayStation({ runner }, { seed: 'Nope' });
    expect(r).toEqual({ playing: false, reason: 'not_found' });
  });

  it('returns ok:false on runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlayStation({ runner }, { seed: 'X' });
    expect((r as any).ok).toBe(false);
  });
});
