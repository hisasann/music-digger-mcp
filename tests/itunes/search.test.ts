import { describe, it, expect, vi } from 'vitest';
import { searchItunesTrack } from '../../src/itunes/search.js';

const okResponse = (results: any[]) =>
  new Response(JSON.stringify({ resultCount: results.length, results }), { status: 200 });

describe('searchItunesTrack', () => {
  it('builds the search URL from artist + track and country', async () => {
    const fetcher = vi.fn(async () => okResponse([]));
    await searchItunesTrack('Roy Ayers', 'Everybody Loves The Sunshine', { fetcher, country: 'us' });
    const url = fetcher.mock.calls[0][0] as string;
    expect(url).toContain('term=Roy%20Ayers%20Everybody%20Loves%20The%20Sunshine');
    expect(url).toContain('country=us');
    expect(url).toContain('entity=song');
  });

  it('defaults country to "jp"', async () => {
    const fetcher = vi.fn(async () => okResponse([]));
    await searchItunesTrack('A', 'T', { fetcher });
    expect((fetcher.mock.calls[0][0] as string)).toContain('country=jp');
  });

  it('returns the first result on hit', async () => {
    const fetcher = vi.fn(async () => okResponse([
      { trackId: 1, trackName: 'T1', artistName: 'A1', collectionName: 'C1', trackViewUrl: 'u1' },
      { trackId: 2, trackName: 'T2', artistName: 'A2', collectionName: 'C2', trackViewUrl: 'u2' },
    ]));
    const r = await searchItunesTrack('A', 'T', { fetcher });
    expect(r?.trackId).toBe(1);
    expect(r?.trackViewUrl).toBe('u1');
  });

  it('returns undefined when results are empty', async () => {
    const fetcher = vi.fn(async () => okResponse([]));
    const r = await searchItunesTrack('A', 'T', { fetcher });
    expect(r).toBeUndefined();
  });

  it('throws on non-OK response', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 500 }));
    await expect(searchItunesTrack('A', 'T', { fetcher })).rejects.toThrow(/HTTP 500/);
  });
});
