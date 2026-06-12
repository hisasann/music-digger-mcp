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
    set st to player state as string
    if st is "playing" or st is "paused" then
      set tr to current track
      set a to artist of tr
      set al to album of tr
      set t to name of tr
      set p to player position
      set d to duration of tr
      return st & "${SEP}" & a & "${SEP}" & al & "${SEP}" & t & "${SEP}" & p & "${SEP}" & d
    else
      return st & "${SEP}${SEP}${SEP}${SEP}${SEP}"
    end if
  else
    return "stopped${SEP}${SEP}${SEP}${SEP}${SEP}"
  end if
end tell
`;

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
    position: posStr ? Number(posStr) : undefined,
    duration: durStr ? Number(durStr) : undefined,
  };
}
