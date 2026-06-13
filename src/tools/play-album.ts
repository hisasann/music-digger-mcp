import { searchYouTube, type SearchDeps } from '../youtube/search.js';
import { openInSafari, videoUrl, type CommandRunner } from '../youtube/open.js';
import { openAppleMusicUrl } from '../itunes/open.js';
import { searchItunesTrack, type ItunesSearchDeps } from '../itunes/search.js';
import type { CurrentPlayback, PlaybackStore } from '../state.js';

export interface PlayAlbumInput { artist: string; album: string; }

export type PlayAlbumOutput =
  | {
      playing: true;
      artist: string;
      album: string;
      played_in: 'apple_music' | 'youtube';
      now_playing: {
        videoId: string;
        title: string;
        channel: string;
        url: string;
        apple_music_url?: string;
        apple_music_artist?: string;
        apple_music_track?: string;
      };
    }
  | { playing: false; reason: 'search_empty' }
  | { ok: false; error: { code: string; message: string } };

export interface PlayAlbumDeps {
  store: PlaybackStore;
  search?: SearchDeps;
  itunes?: ItunesSearchDeps;
  opener?: CommandRunner;
  now?: () => Date;
}

export async function handlePlayAlbum(
  deps: PlayAlbumDeps,
  input: PlayAlbumInput,
): Promise<PlayAlbumOutput> {
  try {
    const query = `${input.artist} ${input.album} full album`;
    const videos = await searchYouTube(query, 5, deps.search);
    const chosen = videos[0];
    if (!chosen) return { playing: false, reason: 'search_empty' };

    const sourceSeed = `${input.artist} / ${input.album}`;
    const url = videoUrl(chosen.videoId);
    const now = (deps.now ?? (() => new Date()))();

    let hit;
    try {
      hit = await searchItunesTrack(input.artist, input.album, deps.itunes);
    } catch {
      hit = undefined;
    }

    if (hit) {
      await openAppleMusicUrl(hit.trackViewUrl, deps.opener);
      const playback: CurrentPlayback = {
        videoId: chosen.videoId,
        title: chosen.title,
        channel: chosen.channel,
        url,
        sourceSeed,
        startedAt: now.toISOString(),
        playedIn: 'apple_music',
        appleMusicUrl: hit.trackViewUrl,
        appleMusicArtist: hit.artistName,
        appleMusicTrack: hit.trackName,
      };
      deps.store.set(playback);
      return {
        playing: true,
        artist: input.artist,
        album: input.album,
        played_in: 'apple_music',
        now_playing: {
          videoId: chosen.videoId,
          title: chosen.title,
          channel: chosen.channel,
          url,
          apple_music_url: hit.trackViewUrl,
          apple_music_artist: hit.artistName,
          apple_music_track: hit.trackName,
        },
      };
    }

    await openInSafari(chosen.videoId, deps.opener);
    const playback: CurrentPlayback = {
      videoId: chosen.videoId,
      title: chosen.title,
      channel: chosen.channel,
      url,
      sourceSeed,
      startedAt: now.toISOString(),
      playedIn: 'youtube',
    };
    deps.store.set(playback);
    return {
      playing: true,
      artist: input.artist,
      album: input.album,
      played_in: 'youtube',
      now_playing: {
        videoId: chosen.videoId,
        title: chosen.title,
        channel: chosen.channel,
        url,
      },
    };
  } catch (e) {
    return { ok: false, error: { code: 'playback_unavailable', message: (e as Error).message } };
  }
}
