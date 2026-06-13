export interface ItunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  trackViewUrl: string;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export interface ItunesSearchDeps {
  fetcher?: Fetcher;
  country?: string;
}

export async function searchItunesTrack(
  artist: string,
  track: string,
  deps: ItunesSearchDeps = {},
): Promise<ItunesTrack | undefined> {
  const fetcher = deps.fetcher ?? fetch;
  const country = deps.country ?? 'jp';
  const term = `${artist} ${track}`.trim();
  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
    `&entity=song&country=${encodeURIComponent(country)}&limit=5`;
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`iTunes search failed: HTTP ${res.status}`);
  const data = (await res.json()) as { results?: ItunesTrack[] };
  const results = data.results ?? [];
  return results[0];
}
