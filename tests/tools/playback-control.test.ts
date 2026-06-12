import { describe, it, expect, vi } from 'vitest';
import { handlePlaybackControl } from '../../src/tools/playback-control.js';

describe('handlePlaybackControl', () => {
  it('returns ok:true with state and repeat_mode', async () => {
    const runner = vi.fn().mockResolvedValue('playing\x1fone');
    const r = await handlePlaybackControl({ runner }, { action: 'repeat_track' });
    expect(r).toEqual({ ok: true, state: 'playing', repeat_mode: 'one' });
  });

  it('returns ok:false on runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlaybackControl({ runner }, { action: 'next' });
    expect((r as any).ok).toBe(false);
    expect((r as any).error.code).toBe('music_app_unavailable');
  });
});
