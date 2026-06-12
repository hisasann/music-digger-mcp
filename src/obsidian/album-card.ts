import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Config } from '../config.js';
import { resolveAlbumCardPath } from './paths.js';
import type { Reaction } from './diary.js';

export type ReactionCounts = Record<Reaction, number>;

export function shouldPromote(counts: ReactionCounts): boolean {
  return counts.love >= 1 || counts.like >= 2;
}

export interface UpsertCardInput {
  artist: string;
  album: string;
  counts: ReactionCounts;
  isoDate: string;
  noteLine?: string;
}

interface CardFrontmatter {
  artist: string;
  album: string;
  reactions: ReactionCounts;
  first_marked: string;
  last_marked: string;
}

function splitFrontmatter(content: string): { fm: CardFrontmatter | null; body: string } {
  if (!content.startsWith('---\n')) return { fm: null, body: content };
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { fm: null, body: content };
  const fmRaw = content.slice(4, end);
  const body = content.slice(end + 5);
  try {
    return { fm: parseYaml(fmRaw) as CardFrontmatter, body };
  } catch {
    return { fm: null, body: content };
  }
}

function joinFrontmatter(fm: CardFrontmatter, body: string): string {
  return '---\n' + stringifyYaml(fm) + '---\n' + body;
}

export async function upsertAlbumCard(cfg: Config, input: UpsertCardInput): Promise<string> {
  const path = resolveAlbumCardPath(cfg, input.artist, input.album);
  await mkdir(dirname(path), { recursive: true });

  let existing = '';
  try { existing = await readFile(path, 'utf8'); } catch { /* new */ }

  const { fm: existingFm, body: existingBody } = splitFrontmatter(existing);

  const fm: CardFrontmatter = {
    artist: input.artist,
    album: input.album,
    reactions: input.counts,
    first_marked: existingFm?.first_marked ?? input.isoDate,
    last_marked: input.isoDate,
  };

  let body = existingBody.trimStart();
  if (!body) body = '\n';
  if (input.noteLine) {
    if (!body.endsWith('\n')) body += '\n';
    body += `- ${input.isoDate}: ${input.noteLine}\n`;
  }

  await writeFile(path, joinFrontmatter(fm, body), 'utf8');
  return path;
}
