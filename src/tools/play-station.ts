import type { Config } from '../config.js';
import { readStationSeeds, pickRandomSeed } from '../obsidian/stations.js';
import { searchYouTube, preferTopicChannel, type SearchDeps, type YouTubeVideo } from '../youtube/search.js';
import { openInSafari, videoUrl, type CommandRunner } from '../youtube/open.js';
import { lookupAppleMusic } from '../itunes/match.js';
import { openAppleMusicUrl } from '../itunes/open.js';
import type { ItunesSearchDeps } from '../itunes/search.js';
import type { CurrentPlayback, PlaybackStore } from '../state.js';

export interface PlayStationInput { seed?: string; }

export type PlayStationOutput =
  | {
      playing: true;
      seed: string;
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
  | { playing: false; reason: 'no_seeds' | 'search_empty' }
  | { ok: false; error: { code: string; message: string } };

export interface PlayStationDeps {
  cfg: Config;
  store: PlaybackStore;
  search?: SearchDeps;
  itunes?: ItunesSearchDeps;
  opener?: CommandRunner;
  rng?: () => number;
  now?: () => Date;
}

async function startPlayback(
  chosen: YouTubeVideo,
  seed: string,
  deps: PlayStationDeps,
): Promise<{ playback: CurrentPlayback; output: PlayStationOutput }> {
  const hit = await lookupAppleMusic(chosen.title, chosen.channel, deps.itunes);
  const now = (deps.now ?? (() => new Date()))();
  const url = videoUrl(chosen.videoId);

  if (hit) {
    await openAppleMusicUrl(hit.trackViewUrl, deps.opener);
    const playback: CurrentPlayback = {
      videoId: chosen.videoId,
      title: chosen.title,
      channel: chosen.channel,
      url,
      sourceSeed: seed,
      startedAt: now.toISOString(),
      playedIn: 'apple_music',
      appleMusicUrl: hit.trackViewUrl,
      appleMusicArtist: hit.artistName,
      appleMusicTrack: hit.trackName,
    };
    return {
      playback,
      output: {
        playing: true,
        seed,
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
      },
    };
  }

  await openInSafari(chosen.videoId, deps.opener);
  const playback: CurrentPlayback = {
    videoId: chosen.videoId,
    title: chosen.title,
    channel: chosen.channel,
    url,
    sourceSeed: seed,
    startedAt: now.toISOString(),
    playedIn: 'youtube',
  };
  return {
    playback,
    output: {
      playing: true,
      seed,
      played_in: 'youtube',
      now_playing: {
        videoId: chosen.videoId,
        title: chosen.title,
        channel: chosen.channel,
        url,
      },
    },
  };
}

export async function handlePlayStation(
  deps: PlayStationDeps,
  input: PlayStationInput,
): Promise<PlayStationOutput> {
  try {
    let seed = input.seed;
    if (!seed) {
      const seeds = await readStationSeeds(deps.cfg);
      const picked = pickRandomSeed(seeds, deps.rng);
      if (!picked) return { playing: false, reason: 'no_seeds' };
      seed = picked;
    }

    const videos = await searchYouTube(seed, 8, deps.search);
    const chosen = preferTopicChannel(videos);
    if (!chosen) return { playing: false, reason: 'search_empty' };

    const { playback, output } = await startPlayback(chosen, seed, deps);
    deps.store.set(playback);
    return output;
  } catch (e) {
    return { ok: false, error: { code: 'playback_unavailable', message: (e as Error).message } };
  }
}
