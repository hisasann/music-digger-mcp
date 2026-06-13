import { describe, it, expect } from 'vitest';
import { handleCurrentTrack } from '../../src/tools/current-track.js';
import { createPlaybackStore } from '../../src/state.js';

describe('handleCurrentTrack', () => {
  it('returns the stored current playback', async () => {
    const store = createPlaybackStore();
    store.set({
      videoId: 'abc',
      title: 'Roy Ayers - Everybody Loves The Sunshine',
      channel: 'Roy Ayers Ubiquity - Topic',
      url: 'https://www.youtube.com/watch?v=abc',
      sourceSeed: 'Roy Ayers',
      startedAt: '2026-06-13T10:00:00.000Z',
    });
    const r = await handleCurrentTrack({ store });
    expect(r).toEqual({
      playing: true,
      current: {
        videoId: 'abc',
        title: 'Roy Ayers - Everybody Loves The Sunshine',
        channel: 'Roy Ayers Ubiquity - Topic',
        url: 'https://www.youtube.com/watch?v=abc',
        sourceSeed: 'Roy Ayers',
        startedAt: '2026-06-13T10:00:00.000Z',
      },
    });
  });

  it('returns playing:false when nothing has been started', async () => {
    const store = createPlaybackStore();
    const r = await handleCurrentTrack({ store });
    expect(r).toEqual({ playing: false });
  });
});
