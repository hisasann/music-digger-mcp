export interface YouTubeVideo {
  videoId: string;
  title: string;
  channel: string;
  duration: string;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface SearchDeps {
  fetcher?: Fetcher;
}

export function extractYtInitialData(html: string): unknown {
  const m = html.match(/var\s+ytInitialData\s*=\s*({[\s\S]+?});\s*<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function pickVideos(data: unknown, limit: number): YouTubeVideo[] {
  const d = data as any;
  const sections =
    d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];
  const out: YouTubeVideo[] = [];
  for (const s of sections) {
    const items = s?.itemSectionRenderer?.contents ?? [];
    for (const it of items) {
      const v = it?.videoRenderer;
      if (!v) continue;
      const videoId = v.videoId;
      if (!videoId) continue;
      const titleRuns: { text: string }[] | undefined = v.title?.runs;
      const title = titleRuns?.map((r) => r.text).join('') ?? v.title?.simpleText ?? '';
      const channel =
        v.ownerText?.runs?.[0]?.text ?? v.longBylineText?.runs?.[0]?.text ?? '';
      const duration = v.lengthText?.simpleText ?? '';
      out.push({ videoId, title, channel, duration });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export async function searchYouTube(
  query: string,
  limit = 8,
  deps: SearchDeps = {},
): Promise<YouTubeVideo[]> {
  const fetcher = deps.fetcher ?? fetch;
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetcher(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.5' },
  });
  if (!res.ok) throw new Error(`YouTube search failed: HTTP ${res.status}`);
  const html = await res.text();
  const data = extractYtInitialData(html);
  if (!data) throw new Error('ytInitialData not found in response');
  return pickVideos(data, limit);
}

/**
 * Prefer the Topic auto-channel (`<Artist> - Topic`) when present —
 * it serves official album audio uploaded by the music industry pipeline,
 * which gives the cleanest metadata for diary entries.
 */
export function preferTopicChannel(videos: YouTubeVideo[]): YouTubeVideo | undefined {
  if (videos.length === 0) return undefined;
  const topic = videos.find((v) => /\bTopic$/i.test(v.channel.trim()));
  return topic ?? videos[0];
}
