import { describe, it, expect, vi } from 'vitest';
import { handlePlayAlbum } from '../../src/tools/play-album.js';
import { createPlaybackStore } from '../../src/state.js';

const fakeYouTubeHtml = (videos: { videoId: string; title: string; channel: string; duration?: string }[]) => {
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
                      lengthText: v.duration ? { simpleText: v.duration } : undefined,
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

const itunesHit = (artist: string, track: string, url: string) =>
  new Response(
    JSON.stringify({
      resultCount: 1,
      results: [{ trackId: 1, trackName: track, artistName: artist, collectionName: 'Album', trackViewUrl: url }],
    }),
    { status: 200 },
  );

const itunesEmpty = () =>
  new Response(JSON.stringify({ resultCount: 0, results: [] }), { status: 200 });

describe('handlePlayAlbum', () => {
  it('iTunes hit → opens Music.app and records playedIn=apple_music', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([
        { videoId: 'fullid', title: "Marvin Gaye - What's Going On (Full Album)", channel: 'Some Uploader' },
      ]),
      { status: 200 },
    ));
    const itunesFetcher = vi.fn(async () =>
      itunesHit('Marvin Gaye', "What's Going On", 'https://music.apple.com/jp/album/wgo'),
    );
    const opener = vi.fn(async () => 0);
    const now = () => new Date('2026-06-13T10:00:00Z');

    const r = await handlePlayAlbum(
      { store, search: { fetcher: ytFetcher }, itunes: { fetcher: itunesFetcher }, opener, now },
      { artist: 'Marvin Gaye', album: "What's Going On" },
    );

    expect((r as any).playing).toBe(true);
    expect((r as any).played_in).toBe('apple_music');
    expect((r as any).now_playing.apple_music_url).toBe('https://music.apple.com/jp/album/wgo');
    expect(opener).toHaveBeenCalledWith('osascript', [
      '-e',
      'tell application "Music" to open location "https://music.apple.com/jp/album/wgo"',
    ]);
    expect(store.get()).toMatchObject({ playedIn: 'apple_music', sourceSeed: "Marvin Gaye / What's Going On" });
  });

  it('iTunes miss → falls back to Safari and records playedIn=youtube', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([{ videoId: 'liveid', title: 'Some Live Bootleg', channel: 'Bootleg Uploader' }]),
      { status: 200 },
    ));
    const itunesFetcher = vi.fn(async () => itunesEmpty());
    const opener = vi.fn(async () => 0);

    const r = await handlePlayAlbum(
      { store, search: { fetcher: ytFetcher }, itunes: { fetcher: itunesFetcher }, opener },
      { artist: 'X', album: 'Y' },
    );

    expect((r as any).playing).toBe(true);
    expect((r as any).played_in).toBe('youtube');
    expect(opener).toHaveBeenCalledWith('open', ['-a', 'Safari', 'https://www.youtube.com/watch?v=liveid']);
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
    expect((r as any).error.code).toBe('playback_unavailable');
    expect(opener).not.toHaveBeenCalled();
  });
});
