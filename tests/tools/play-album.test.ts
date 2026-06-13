import { describe, it, expect, vi } from 'vitest';
import { handlePlayAlbum } from '../../src/tools/play-album.js';
import { createPlaybackStore } from '../../src/state.js';

const fakeYouTubeHtml = (videos: { videoId: string; title: string; channel: string }[]) => {
  const data = {
    contents: {
      twoColumnSearchResultsRenderer: {
        primaryContents: {
          sectionListRenderer: {
            contents: [
              {
                itemSectionRenderer: {
                  contents: videos.map((v) => ({
                    videoRenderer: {
                      videoId: v.videoId,
                      title: { simpleText: v.title },
                      ownerText: { runs: [{ text: v.channel }] },
                    },
                  })),
                },
              },
            ],
          },
        },
      },
    },
  };
  return `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
};

describe('handlePlayAlbum', () => {
  it('searches YouTube for a full-album upload, opens Safari, stores playedIn=youtube', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([
        { videoId: 'fullid', title: 'Marvin Gaye - What\'s Going On (Full Album)', channel: 'Some Uploader' },
      ]),
      { status: 200 },
    ));
    const opener = vi.fn(async () => 0);
    const now = () => new Date('2026-06-13T10:00:00Z');

    const r = await handlePlayAlbum(
      { store, search: { fetcher: ytFetcher }, opener, now },
      { artist: 'Marvin Gaye', album: "What's Going On" },
    );

    expect(r).toEqual({
      playing: true,
      artist: 'Marvin Gaye',
      album: "What's Going On",
      now_playing: {
        videoId: 'fullid',
        title: 'Marvin Gaye - What\'s Going On (Full Album)',
        channel: 'Some Uploader',
        url: 'https://www.youtube.com/watch?v=fullid',
      },
    });
    const searchUrl = ytFetcher.mock.calls[0][0] as string;
    expect(searchUrl).toContain('search_query=Marvin');
    expect(searchUrl).toContain('full');
    expect(opener).toHaveBeenCalledWith('open', ['-a', 'Safari', 'https://www.youtube.com/watch?v=fullid']);
    expect(store.get()).toMatchObject({ videoId: 'fullid', sourceSeed: "Marvin Gaye / What's Going On", playedIn: 'youtube' });
  });

  it('returns search_empty when YouTube returns no videos', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(fakeYouTubeHtml([]), { status: 200 }));
    const opener = vi.fn(async () => 0);
    const r = await handlePlayAlbum(
      { store, search: { fetcher: ytFetcher }, opener },
      { artist: 'X', album: 'Y' },
    );
    expect(r).toEqual({ playing: false, reason: 'search_empty' });
    expect(opener).not.toHaveBeenCalled();
    expect(store.get()).toBeUndefined();
  });

  it('returns ok:false on YouTube search failure', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response('', { status: 500 }));
    const opener = vi.fn(async () => 0);
    const r = await handlePlayAlbum(
      { store, search: { fetcher: ytFetcher }, opener },
      { artist: 'A', album: 'B' },
    );
    expect((r as any).ok).toBe(false);
    expect((r as any).error.code).toBe('youtube_unavailable');
    expect(opener).not.toHaveBeenCalled();
  });
});
