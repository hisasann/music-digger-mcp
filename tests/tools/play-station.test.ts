import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePlayStation } from '../../src/tools/play-station.js';
import { createPlaybackStore } from '../../src/state.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
  stationsPath: 'music/stations.md',
});

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

describe('handlePlayStation', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('iTunes hit → opens Music.app and records playedIn=apple_music', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([{ videoId: 'bbb', title: 'Aaron Frazer - Bad News', channel: 'Aaron Frazer - Topic' }]),
      { status: 200 },
    ));
    const itunesFetcher = vi.fn(async () => itunesHit('Aaron Frazer', 'Bad News', 'https://music.apple.com/jp/x?i=1'));
    const opener = vi.fn(async () => 0);

    const r = await handlePlayStation(
      {
        cfg: cfg(vault),
        store,
        search: { fetcher: ytFetcher },
        itunes: { fetcher: itunesFetcher },
        opener,
      },
      { seed: 'Aaron Frazer' },
    );

    expect((r as any).playing).toBe(true);
    expect((r as any).played_in).toBe('apple_music');
    expect((r as any).now_playing).toMatchObject({
      videoId: 'bbb',
      apple_music_url: 'https://music.apple.com/jp/x?i=1',
      apple_music_artist: 'Aaron Frazer',
      apple_music_track: 'Bad News',
    });
    expect(opener).toHaveBeenCalledWith('osascript', [
      '-e',
      'tell application "Music" to open location "https://music.apple.com/jp/x?i=1"',
    ]);
    expect(store.get()).toMatchObject({ playedIn: 'apple_music', appleMusicUrl: 'https://music.apple.com/jp/x?i=1' });
  });

  it('iTunes miss → falls back to Safari and records playedIn=youtube', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([{ videoId: 'liveid', title: 'Some Live Cover That Itunes Doesnt Have', channel: 'Random' }]),
      { status: 200 },
    ));
    const itunesFetcher = vi.fn(async () => itunesEmpty());
    const opener = vi.fn(async () => 0);

    const r = await handlePlayStation(
      {
        cfg: cfg(vault),
        store,
        search: { fetcher: ytFetcher },
        itunes: { fetcher: itunesFetcher },
        opener,
      },
      { seed: 'something obscure' },
    );

    expect((r as any).playing).toBe(true);
    expect((r as any).played_in).toBe('youtube');
    expect(opener).toHaveBeenCalledWith('open', ['-a', 'Safari', 'https://www.youtube.com/watch?v=liveid']);
    expect(store.get()).toMatchObject({ playedIn: 'youtube' });
  });

  it('falls back to the stations note when seed is omitted', async () => {
    mkdirSync(join(vault, 'music'), { recursive: true });
    writeFileSync(join(vault, 'music/stations.md'), '- Aaron Frazer\n- Curtis Harding\n');
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([{ videoId: 'ch1', title: 'Curtis Harding - The Power', channel: 'Curtis Harding - Topic' }]),
      { status: 200 },
    ));
    const itunesFetcher = vi.fn(async () => itunesHit('Curtis Harding', 'The Power', 'https://music.apple.com/jp/p'));
    const opener = vi.fn(async () => 0);
    const rng = () => 0.99; // last seed

    const r = await handlePlayStation(
      {
        cfg: cfg(vault),
        store,
        search: { fetcher: ytFetcher },
        itunes: { fetcher: itunesFetcher },
        opener,
        rng,
      },
      {},
    );

    expect((r as any).playing).toBe(true);
    expect((r as any).seed).toBe('Curtis Harding');
    const ytUrl = ytFetcher.mock.calls[0][0] as string;
    expect(ytUrl).toContain('search_query=Curtis%20Harding');
  });

  it('returns no_seeds when stations note is missing', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn();
    const itunesFetcher = vi.fn();
    const opener = vi.fn();
    const r = await handlePlayStation(
      {
        cfg: cfg(vault),
        store,
        search: { fetcher: ytFetcher },
        itunes: { fetcher: itunesFetcher },
        opener,
      },
      {},
    );
    expect(r).toEqual({ playing: false, reason: 'no_seeds' });
    expect(ytFetcher).not.toHaveBeenCalled();
    expect(opener).not.toHaveBeenCalled();
  });

  it('returns search_empty when YouTube has no matches', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(fakeYouTubeHtml([]), { status: 200 }));
    const opener = vi.fn(async () => 0);
    const r = await handlePlayStation(
      { cfg: cfg(vault), store, search: { fetcher: ytFetcher }, opener },
      { seed: 'Nonexistent' },
    );
    expect(r).toEqual({ playing: false, reason: 'search_empty' });
    expect(opener).not.toHaveBeenCalled();
  });

  it('returns ok:false on YouTube search failure', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response('', { status: 503 }));
    const opener = vi.fn(async () => 0);
    const r = await handlePlayStation(
      { cfg: cfg(vault), store, search: { fetcher: ytFetcher }, opener },
      { seed: 'X' },
    );
    expect((r as any).ok).toBe(false);
    expect((r as any).error.code).toBe('playback_unavailable');
  });
});
