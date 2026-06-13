import { parseTrackTitle } from '../youtube/metadata.js';
import { searchItunesTrack, type ItunesSearchDeps, type ItunesTrack } from './search.js';

/**
 * Bridge YouTube → Apple Music. When `artistHint` is provided (the
 * play_station seed, which the user authored), use it as the artist
 * authority and only parse the YouTube title for the track name. This
 * guards against AI-generated YouTube content like
 * "Marvin Gaye Inspired Soul" — the parser would otherwise return a
 * bogus artist and iTunes can return a wildly unrelated song.
 *
 * Without a hint, fall back to title-parsing for both fields (covers the
 * play_album path where the artist is given explicitly upstream).
 *
 * Returns `undefined` on any miss so the caller can transparently fall
 * back to the YouTube video.
 */
export async function lookupAppleMusic(
  title: string,
  channel: string,
  deps?: ItunesSearchDeps,
  artistHint?: string,
): Promise<ItunesTrack | undefined> {
  const parsed = parseTrackTitle(title, channel);
  const artist = artistHint?.trim() || parsed.artist;
  const track = parsed.track || title;
  if (!artist || !track) return undefined;
  try {
    return await searchItunesTrack(artist, track, deps);
  } catch {
    return undefined;
  }
}
