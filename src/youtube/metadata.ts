export interface ParsedMetadata {
  artist: string;
  track: string;
  album: string;
}

const NOISE_PATTERNS = [
  /\(official\s*(audio|video|music\s*video|lyric\s*video|visualizer)\)/i,
  /\[official\s*(audio|video|music\s*video|lyric\s*video|visualizer)\]/i,
  /\(lyrics?\)/i,
  /\[lyrics?\]/i,
  /\(hq\)/i,
  /\(remastered\)/i,
  /\(full\s*album\)/i,
  /\[full\s*album\]/i,
  /\bfull\s*album\b/i,
  /\(\d{4}\)/,
  /\[\d{4}\]/,
  /\s-\s*\d{4}\b/,
];

export function stripTitleNoise(s: string): string {
  let r = s;
  for (const p of NOISE_PATTERNS) r = r.replace(p, '');
  return r.replace(/\s{2,}/g, ' ').trim();
}

export function parseTrackTitle(title: string, channel: string): ParsedMetadata {
  const cleanTitle = stripTitleNoise(title);
  const album = channel.replace(/\s*-\s*Topic\s*$/i, '').trim();

  const dashIdx = cleanTitle.indexOf(' - ');
  if (dashIdx > 0) {
    const artist = cleanTitle.slice(0, dashIdx).trim();
    const track = cleanTitle.slice(dashIdx + 3).trim();
    return { artist, track, album: album || artist };
  }
  return { artist: album || channel || 'Unknown', track: cleanTitle, album: album || channel || 'Unknown' };
}
