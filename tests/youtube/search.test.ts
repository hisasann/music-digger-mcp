import { describe, it, expect, vi } from 'vitest';
import {
  extractYtInitialData,
  pickVideos,
  preferTopicChannel,
  searchYouTube,
} from '../../src/youtube/search.js';

const fakeInitialData = (
  videos: { videoId: string; titleRuns?: string[]; titleSimple?: string; channel?: string; duration?: string }[],
) => ({
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
                    title: v.titleRuns
                      ? { runs: v.titleRuns.map((t) => ({ text: t })) }
                      : { simpleText: v.titleSimple ?? '' },
                    ownerText: v.channel ? { runs: [{ text: v.channel }] } : undefined,
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
});

describe('extractYtInitialData', () => {
  it('parses the var ytInitialData = {...}; block', () => {
    const html = `<html><body><script>var ytInitialData = {"a":1,"b":[2,3]};</script></body></html>`;
    expect(extractYtInitialData(html)).toEqual({ a: 1, b: [2, 3] });
  });

  it('returns null when no ytInitialData is present', () => {
    expect(extractYtInitialData('<html></html>')).toBeNull();
  });

  it('returns null when JSON is malformed', () => {
    const html = `<script>var ytInitialData = {not json};</script>`;
    expect(extractYtInitialData(html)).toBeNull();
  });
});

describe('pickVideos', () => {
  it('extracts up to `limit` videos from a search response', () => {
    const data = fakeInitialData([
      { videoId: 'aaa', titleRuns: ['Title A'], channel: 'Chan A', duration: '3:14' },
      { videoId: 'bbb', titleSimple: 'Title B', channel: 'Chan B', duration: '4:20' },
      { videoId: 'ccc', titleRuns: ['Title C'], channel: 'Chan C', duration: '5:00' },
    ]);
    expect(pickVideos(data, 2)).toEqual([
      { videoId: 'aaa', title: 'Title A', channel: 'Chan A', duration: '3:14' },
      { videoId: 'bbb', title: 'Title B', channel: 'Chan B', duration: '4:20' },
    ]);
  });

  it('skips itemSectionRenderer entries without videoRenderer (ads, shelves, etc.)', () => {
    const data = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      { adSlotRenderer: {} },
                      { shelfRenderer: {} },
                      {
                        videoRenderer: {
                          videoId: 'real',
                          title: { simpleText: 'Real Video' },
                          ownerText: { runs: [{ text: 'Real Channel' }] },
                          lengthText: { simpleText: '1:00' },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };
    expect(pickVideos(data, 5)).toEqual([
      { videoId: 'real', title: 'Real Video', channel: 'Real Channel', duration: '1:00' },
    ]);
  });

  it('returns [] for shape mismatch', () => {
    expect(pickVideos({}, 5)).toEqual([]);
    expect(pickVideos(null, 5)).toEqual([]);
  });
});

describe('preferTopicChannel', () => {
  it('returns undefined for an empty list', () => {
    expect(preferTopicChannel([])).toBeUndefined();
  });

  it('picks the Topic channel when one exists', () => {
    const videos = [
      { videoId: 'a', title: 't1', channel: 'Random Uploader', duration: '3:00' },
      { videoId: 'b', title: 't2', channel: 'Roy Ayers Ubiquity - Topic', duration: '4:00' },
      { videoId: 'c', title: 't3', channel: 'Other', duration: '5:00' },
    ];
    expect(preferTopicChannel(videos)?.videoId).toBe('b');
  });

  it('falls back to the first video when no Topic channel is present', () => {
    const videos = [
      { videoId: 'a', title: 't1', channel: 'Random Uploader', duration: '3:00' },
      { videoId: 'b', title: 't2', channel: 'Another', duration: '4:00' },
    ];
    expect(preferTopicChannel(videos)?.videoId).toBe('a');
  });

  it('is case insensitive on the "Topic" suffix', () => {
    const videos = [
      { videoId: 'a', title: 't1', channel: 'Foo', duration: '3:00' },
      { videoId: 'b', title: 't2', channel: 'Bar - topic', duration: '4:00' },
    ];
    expect(preferTopicChannel(videos)?.videoId).toBe('b');
  });
});

describe('searchYouTube', () => {
  it('passes the query through URL encoding and parses the response', async () => {
    const data = fakeInitialData([
      { videoId: 'xyz', titleSimple: 'Some Track', channel: 'Some Channel', duration: '2:30' },
    ]);
    const html = `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
    const fetcher = vi.fn(async () => new Response(html, { status: 200 }));
    const videos = await searchYouTube('Roy Ayers & friends', 5, { fetcher });
    expect(videos).toEqual([
      { videoId: 'xyz', title: 'Some Track', channel: 'Some Channel', duration: '2:30' },
    ]);
    const url = fetcher.mock.calls[0][0] as string;
    expect(url).toContain('search_query=Roy%20Ayers%20%26%20friends');
  });

  it('throws on non-OK response', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 503 }));
    await expect(searchYouTube('q', 5, { fetcher })).rejects.toThrow(/HTTP 503/);
  });

  it('throws when ytInitialData is missing', async () => {
    const fetcher = vi.fn(async () => new Response('<html></html>', { status: 200 }));
    await expect(searchYouTube('q', 5, { fetcher })).rejects.toThrow(/ytInitialData/);
  });
});
