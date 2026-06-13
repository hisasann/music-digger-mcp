import { parseTrackTitle } from '../youtube/metadata.js';
import { searchItunesTrack, type ItunesSearchDeps, type ItunesTrack } from './search.js';

/**
 * Bridge YouTube → Apple Music: take a YouTube video's title/channel,
 * parse out artist+track, and look it up in the iTunes catalog.
 * Returns `undefined` on any miss (no match, or search error) so the
 * caller can transparently fall back to playing the YouTube video.
 */
export async function lookupAppleMusic(
  title: string,
  channel: string,
  deps?: ItunesSearchDeps,
): Promise<ItunesTrack | undefined> {
  const { artist, track } = parseTrackTitle(title, channel);
  if (!artist || !track) return undefined;
  try {
    return await searchItunesTrack(artist, track, deps);
  } catch {
    return undefined;
  }
}
