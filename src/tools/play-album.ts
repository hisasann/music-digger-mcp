import { searchYouTube, type SearchDeps } from '../youtube/search.js';
import { openInSafari, videoUrl, type CommandRunner } from '../youtube/open.js';
import type { PlaybackStore } from '../state.js';

export interface PlayAlbumInput { artist: string; album: string; }

export type PlayAlbumOutput =
  | {
      playing: true;
      artist: string;
      album: string;
      now_playing: { videoId: string; title: string; channel: string; url: string };
    }
  | { playing: false; reason: 'search_empty' }
  | { ok: false; error: { code: string; message: string } };

export interface PlayAlbumDeps {
  store: PlaybackStore;
  search?: SearchDeps;
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

    await openInSafari(chosen.videoId, deps.opener);

    const url = videoUrl(chosen.videoId);
    const now = (deps.now ?? (() => new Date()))();
    deps.store.set({
      videoId: chosen.videoId,
      title: chosen.title,
      channel: chosen.channel,
      url,
      sourceSeed: `${input.artist} / ${input.album}`,
      startedAt: now.toISOString(),
    });

    return {
      playing: true,
      artist: input.artist,
      album: input.album,
      now_playing: { videoId: chosen.videoId, title: chosen.title, channel: chosen.channel, url },
    };
  } catch (e) {
    return { ok: false, error: { code: 'youtube_unavailable', message: (e as Error).message } };
  }
}
