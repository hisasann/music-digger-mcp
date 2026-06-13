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

describe('handlePlayStation', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('searches YouTube, prefers the Topic channel, opens Safari, stores playedIn=youtube', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([
        { videoId: 'aaa', title: 'Random Cover', channel: 'Some Cover Channel' },
        { videoId: 'bbb', title: 'Aaron Frazer - Bad News', channel: 'Aaron Frazer - Topic' },
      ]),
      { status: 200 },
    ));
    const opener = vi.fn(async () => 0);
    const now = () => new Date('2026-06-13T10:00:00Z');

    const r = await handlePlayStation(
      { cfg: cfg(vault), store, search: { fetcher: ytFetcher }, opener, now },
      { seed: 'Aaron Frazer' },
    );

    expect(r).toEqual({
      playing: true,
      seed: 'Aaron Frazer',
      now_playing: {
        videoId: 'bbb',
        title: 'Aaron Frazer - Bad News',
        channel: 'Aaron Frazer - Topic',
        url: 'https://www.youtube.com/watch?v=bbb',
      },
    });
    expect(opener).toHaveBeenCalledWith('open', ['-a', 'Safari', 'https://www.youtube.com/watch?v=bbb']);
    expect(store.get()).toMatchObject({ videoId: 'bbb', sourceSeed: 'Aaron Frazer', playedIn: 'youtube' });
  });

  it('falls back to the stations note when seed is omitted', async () => {
    mkdirSync(join(vault, 'music'), { recursive: true });
    writeFileSync(join(vault, 'music/stations.md'), '- Aaron Frazer\n- Curtis Harding\n');
    const store = createPlaybackStore();
    const ytFetcher = vi.fn(async () => new Response(
      fakeYouTubeHtml([{ videoId: 'ch1', title: 'Curtis Harding - The Power', channel: 'Curtis Harding - Topic' }]),
      { status: 200 },
    ));
    const opener = vi.fn(async () => 0);
    const rng = () => 0.99;

    const r = await handlePlayStation(
      { cfg: cfg(vault), store, search: { fetcher: ytFetcher }, opener, rng },
      {},
    );

    expect((r as any).playing).toBe(true);
    expect((r as any).seed).toBe('Curtis Harding');
    expect((ytFetcher.mock.calls[0][0] as string)).toContain('search_query=Curtis%20Harding');
  });

  it('returns no_seeds when stations note is missing', async () => {
    const store = createPlaybackStore();
    const ytFetcher = vi.fn();
    const opener = vi.fn();
    const r = await handlePlayStation(
      { cfg: cfg(vault), store, search: { fetcher: ytFetcher }, opener },
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
    expect((r as any).error.code).toBe('youtube_unavailable');
  });
});
