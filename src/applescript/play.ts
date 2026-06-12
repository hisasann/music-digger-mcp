import type { AppleScriptRunner } from './runner.js';

const SEP = '\x1f';

export type PlayAlbumResult =
  | { ok: true; artist: string; album: string; first_track: string }
  | { ok: false; reason: 'not_found' };

export type PlayStationResult =
  | { ok: true; seed: string; starting_track: { artist: string; album: string; track: string } }
  | { ok: false; reason: 'not_found' };

function escapeDoubleQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

export async function playAlbumByName(
  runner: AppleScriptRunner,
  artist: string,
  album: string,
): Promise<PlayAlbumResult> {
  const script = `
tell application "Music"
  set hits to (every track of library playlist 1 whose artist is "${escapeDoubleQuotes(artist)}" and album is "${escapeDoubleQuotes(album)}")
  if (count of hits) is 0 then
    return "not_found${SEP}${SEP}${SEP}"
  end if
  set firstTrack to item 1 of hits
  play firstTrack
  return "ok${SEP}" & (artist of firstTrack) & "${SEP}" & (album of firstTrack) & "${SEP}" & (name of firstTrack)
end tell
`;
  const out = await runner(script);
  const [status, a, al, t] = out.split(SEP);
  if (status !== 'ok') return { ok: false, reason: 'not_found' };
  return { ok: true, artist: a, album: al, first_track: t };
}

export async function playStationFromSeed(
  runner: AppleScriptRunner,
  seed: string,
): Promise<PlayStationResult> {
  const script = `
tell application "Music"
  set seedHits to (every track whose artist contains "${escapeDoubleQuotes(seed)}" or genre contains "${escapeDoubleQuotes(seed)}")
  if (count of seedHits) is 0 then
    return "not_found${SEP}${SEP}${SEP}${SEP}"
  end if
  set seedTrack to item 1 of seedHits
  play seedTrack
  try
    tell seedTrack to reveal
    set song station of front window to true
  on error
    -- station start is best-effort; fall back to plain playback
  end try
  return "ok${SEP}" & (artist of seedTrack) & "${SEP}" & (album of seedTrack) & "${SEP}" & (name of seedTrack)
end tell
`;
  const out = await runner(script);
  const [status, artist, album, track] = out.split(SEP);
  if (status !== 'ok') return { ok: false, reason: 'not_found' };
  return { ok: true, seed, starting_track: { artist, album, track } };
}
