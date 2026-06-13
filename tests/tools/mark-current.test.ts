import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleMarkCurrent } from '../../src/tools/mark-current.js';
import { createPlaybackStore, type PlaybackStore } from '../../src/state.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
  stationsPath: 'music/stations.md',
});

function withTrack(
  store: PlaybackStore,
  title: string,
  channel: string,
  playedIn: 'apple_music' | 'youtube' = 'youtube',
): void {
  store.set({
    videoId: 'vid',
    title,
    channel,
    url: 'https://www.youtube.com/watch?v=vid',
    startedAt: '2026-06-12T21:35:00.000Z',
    playedIn,
  });
}

const itunesResponseFor = (artist: string, track: string, url: string) =>
  new Response(
    JSON.stringify({ resultCount: 1, results: [{ trackId: 1, trackName: track, artistName: artist, collectionName: 'Album', trackViewUrl: url }] }),
    { status: 200 },
  );

const emptyItunesResponse = () =>
  new Response(JSON.stringify({ resultCount: 0, results: [] }), { status: 200 });

describe('handleMarkCurrent', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('returns nothing_playing when nothing has been started', async () => {
    const store = createPlaybackStore();
    const r = await handleMarkCurrent(
      { store },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T21:35:00') },
    );
    expect(r).toEqual({ marked: false, reason: 'nothing_playing' });
  });

  it('when already playing in Apple Music: writes diary but skips Apple Music open', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'Curtis Harding - The Power', 'Curtis Harding', 'apple_music');
    const fetcher = vi.fn();
    const opener = vi.fn();
    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-13T10:00:00') },
    );
    expect((r as any).marked).toBe(true);
    expect((r as any).apple_music).toEqual({ opened: false, reason: 'already_in_apple_music' });
    expect(opener).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('on love (YouTube fallback): writes diary, opens Apple Music, and promotes', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'Marvin Gaye - Inner City Blues (Official Audio)', 'Marvin Gaye - Topic');
    const fetcher = vi.fn(async () =>
      itunesResponseFor('Marvin Gaye', 'Inner City Blues', 'https://music.apple.com/jp/x?i=1'),
    );
    const opener = vi.fn(async () => 0);

    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      { reaction: 'love', note: 'やばい' },
      { now: () => new Date('2026-06-12T21:35:00') },
    );

    expect((r as any).marked).toBe(true);
    expect((r as any).promoted).toBe(true);
    expect((r as any).apple_music).toEqual({
      opened: true,
      url: 'https://music.apple.com/jp/x?i=1',
      matched_artist: 'Marvin Gaye',
      matched_track: 'Inner City Blues',
    });
    expect(opener).toHaveBeenCalledWith('open', ['-a', 'Music', 'https://music.apple.com/jp/x?i=1']);

    const diary = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(diary).toContain('## 21:35 — ♥ Marvin Gaye / Inner City Blues');
    expect(diary).toContain('やばい');
  });

  it('honors explicit artist / album / track overrides for both diary and Apple Music search', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'noisy yt title (Full Album) [HQ]', 'Random Uploader 1969');
    const fetcher = vi.fn(async () =>
      itunesResponseFor('Roy Ayers', 'Everybody Loves The Sunshine', 'https://music.apple.com/jp/y'),
    );
    const opener = vi.fn(async () => 0);

    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      {
        reaction: 'love',
        artist: 'Roy Ayers',
        album: 'Everybody Loves The Sunshine',
        track: 'Everybody Loves The Sunshine',
      },
      { now: () => new Date('2026-06-12T21:35:00') },
    );

    expect((r as any).marked).toBe(true);
    const searchUrl = fetcher.mock.calls[0][0] as string;
    expect(searchUrl).toContain('term=Roy%20Ayers%20Everybody%20Loves%20The%20Sunshine');
    const diary = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(diary).toContain('Roy Ayers / Everybody Loves The Sunshine');
  });

  it('on meh: writes diary but skips Apple Music', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'A - T', 'A - Topic');
    const fetcher = vi.fn();
    const opener = vi.fn();
    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      { reaction: 'meh' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect((r as any).marked).toBe(true);
    expect((r as any).apple_music).toEqual({ opened: false, reason: 'skipped_reaction' });
    expect(opener).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('on like with no iTunes match: writes diary, reports no_match', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'A - T', 'A - Topic');
    const fetcher = vi.fn(async () => emptyItunesResponse());
    const opener = vi.fn();
    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      { reaction: 'like' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect((r as any).marked).toBe(true);
    expect((r as any).apple_music).toEqual({ opened: false, reason: 'no_match' });
    expect(opener).not.toHaveBeenCalled();
  });

  it('on love with iTunes search failure: still writes diary, reports search_failed', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'A - T', 'A - Topic');
    const fetcher = vi.fn(async () => new Response('', { status: 503 }));
    const opener = vi.fn();
    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect((r as any).marked).toBe(true);
    expect((r as any).apple_music).toEqual({ opened: false, reason: 'search_failed' });
  });

  it('does not promote on a single "like"', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'A - T', 'A - Topic');
    const fetcher = vi.fn(async () => emptyItunesResponse());
    const opener = vi.fn();
    const r = await handleMarkCurrent(
      { store, itunes: { fetcher }, opener },
      cfg(vault),
      { reaction: 'like' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect((r as any).marked).toBe(true);
    expect((r as any).promoted).toBe(false);
    expect(readdirSync(join(vault, 'music/albums'))).toEqual([]);
  });

  it('promotes after two "like"s on same album across two days', async () => {
    const store = createPlaybackStore();
    withTrack(store, 'A - T', 'A - Topic');
    const fetcher = vi.fn(async () => emptyItunesResponse());
    const opener = vi.fn();
    await handleMarkCurrent({ store, itunes: { fetcher }, opener }, cfg(vault),
      { reaction: 'like' }, { now: () => new Date('2026-06-10T10:00:00') });
    const r = await handleMarkCurrent({ store, itunes: { fetcher }, opener }, cfg(vault),
      { reaction: 'like' }, { now: () => new Date('2026-06-12T10:00:00') });
    expect((r as any).promoted).toBe(true);
    expect(readdirSync(join(vault, 'music/albums'))).toContain('A - A.md');
  });

  it('refuses to write when iCloud placeholder exists for diary file', async () => {
    const { mkdirSync, writeFileSync: w } = await import('node:fs');
    mkdirSync(join(vault, 'music/diary'), { recursive: true });
    w(join(vault, 'music/diary/.2026-06-12.md.icloud'), '');
    const store = createPlaybackStore();
    withTrack(store, 'A - T', 'A - Topic');
    const r = await handleMarkCurrent(
      { store },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect(r).toEqual({
      marked: false,
      reason: 'icloud_placeholder',
      path: expect.stringContaining('2026-06-12.md'),
    });
  });
});
