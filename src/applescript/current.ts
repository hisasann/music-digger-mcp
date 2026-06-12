import type { AppleScriptRunner } from './runner.js';

export interface CurrentTrack {
  playing: boolean;
  artist?: string;
  album?: string;
  track?: string;
  position?: number;
  duration?: number;
}

const SEP = '\x1f';

const SCRIPT = `
tell application "Music"
  if it is running then
    set playerStateText to (player state as text)
    if playerStateText is "playing" or playerStateText is "paused" then
      set curTrack to current track
      set curArtist to artist of curTrack
      set curAlbum to album of curTrack
      set curName to name of curTrack
      set curPos to player position
      set curDur to duration of curTrack
      return playerStateText & "${SEP}" & curArtist & "${SEP}" & curAlbum & "${SEP}" & curName & "${SEP}" & curPos & "${SEP}" & curDur
    else
      return playerStateText & "${SEP}${SEP}${SEP}${SEP}${SEP}"
    end if
  else
    return "stopped${SEP}${SEP}${SEP}${SEP}${SEP}"
  end if
end tell
`;

const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

export async function getCurrentTrack(runner: AppleScriptRunner): Promise<CurrentTrack> {
  const out = await runner(SCRIPT);
  const [state, artist, album, track, posStr, durStr] = out.split(SEP);
  if (state !== 'playing' && state !== 'paused') {
    return { playing: false };
  }
  return {
    playing: state === 'playing',
    artist: artist || undefined,
    album: album || undefined,
    track: track || undefined,
    position: num(posStr),
    duration: num(durStr),
  };
}
