import { describe, it, expect, vi } from 'vitest';
import { getCurrentTrack } from '../../src/applescript/current.js';

describe('getCurrentTrack', () => {
  it('parses delimited osascript output into a struct', async () => {
    const runner = vi.fn().mockResolvedValue(
      'playing\x1fMarvin Gaye\x1fWhat\'s Going On\x1fInner City Blues\x1f120\x1f300'
    );
    const result = await getCurrentTrack(runner);
    expect(result).toEqual({
      playing: true,
      artist: 'Marvin Gaye',
      album: "What's Going On",
      track: 'Inner City Blues',
      position: 120,
      duration: 300,
    });
  });

  it('returns playing=false when nothing is playing', async () => {
    const runner = vi.fn().mockResolvedValue('stopped\x1f\x1f\x1f\x1f\x1f');
    const result = await getCurrentTrack(runner);
    expect(result.playing).toBe(false);
    expect(result.artist).toBeUndefined();
  });

  it('treats "paused" state as playing=false but keeps track info', async () => {
    const runner = vi.fn().mockResolvedValue(
      'paused\x1fArtist\x1fAlbum\x1fTrack\x1f10\x1f200'
    );
    const result = await getCurrentTrack(runner);
    expect(result.playing).toBe(false);
    expect(result.artist).toBe('Artist');
    expect(result.album).toBe('Album');
  });
});
