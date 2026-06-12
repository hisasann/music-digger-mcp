import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Config } from '../config.js';
import { resolveDiaryPath } from './paths.js';

export type Reaction = 'love' | 'like' | 'meh' | 'skip';

const ICON: Record<Reaction, string> = {
  love: '♥ ',
  like: '★ ',
  meh: '',
  skip: '× ',
};

export interface DiaryEntry {
  isoDate: string;
  time: string;
  artist: string;
  album: string;
  track: string;
  reaction: Reaction;
  note?: string;
}

function formatEntry(e: DiaryEntry): string {
  const icon = ICON[e.reaction];
  const header = `## ${e.time} — ${icon}${e.artist} / ${e.track} (${e.album})`;
  const lines = [header, e.reaction];
  if (e.note) lines.push(`- "${e.note}"`);
  return lines.join('\n') + '\n';
}

export async function appendDiaryEntry(cfg: Config, entry: DiaryEntry): Promise<string> {
  const path = resolveDiaryPath(cfg, entry.isoDate);
  await mkdir(dirname(path), { recursive: true });

  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch {
    // new file
  }

  const header = existing ? '' : `# ${entry.isoDate}\n\n`;
  const separator = existing && !existing.endsWith('\n\n') ? '\n' : '';
  const next = existing + header + separator + formatEntry(entry);
  await writeFile(path, next, 'utf8');
  return path;
}

const ENTRY_HEADER_RE = /^## \d{2}:\d{2} — (?:[♥★×] )?(.+?) \/ (.+?) \((.+?)\)$/gm;

export function parseAlbumReactions(
  diaryContents: string[],
  artist: string,
  album: string,
): Record<Reaction, number> {
  const counts: Record<Reaction, number> = { love: 0, like: 0, meh: 0, skip: 0 };
  for (const content of diaryContents) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const headerMatch = lines[i].match(/^## \d{2}:\d{2} — (?:[♥★×] )?(.+?) \/ (.+?) \((.+?)\)$/);
      if (!headerMatch) continue;
      const [, a, , al] = headerMatch;
      if (a !== artist || al !== album) continue;
      const reactionLine = lines[i + 1]?.trim();
      if (reactionLine === 'love' || reactionLine === 'like' || reactionLine === 'meh' || reactionLine === 'skip') {
        counts[reactionLine]++;
      }
    }
  }
  return counts;
}
