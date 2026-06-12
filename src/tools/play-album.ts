import { playAlbumByName } from '../applescript/play.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlayAlbumInput { artist: string; album: string; }
export type PlayAlbumOutput =
  | { playing: true; artist: string; album: string; first_track: string }
  | { playing: false; reason: 'not_found' }
  | ToolError;

export async function handlePlayAlbum(
  deps: ToolDeps,
  input: PlayAlbumInput,
): Promise<PlayAlbumOutput> {
  try {
    const r = await playAlbumByName(deps.runner, input.artist, input.album);
    if (r.ok) return { playing: true, artist: r.artist, album: r.album, first_track: r.first_track };
    return { playing: false, reason: r.reason };
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
