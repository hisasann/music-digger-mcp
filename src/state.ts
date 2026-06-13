export type PlayedIn = 'apple_music' | 'youtube';

export interface CurrentPlayback {
  videoId: string;
  title: string;
  channel: string;
  url: string;
  sourceSeed?: string;
  startedAt: string;
  playedIn: PlayedIn;
  appleMusicUrl?: string;
  appleMusicArtist?: string;
  appleMusicTrack?: string;
}

export interface PlaybackStore {
  get(): CurrentPlayback | undefined;
  set(p: CurrentPlayback): void;
  clear(): void;
}

export function createPlaybackStore(): PlaybackStore {
  let current: CurrentPlayback | undefined;
  return {
    get: () => current,
    set: (p) => { current = p; },
    clear: () => { current = undefined; },
  };
}
