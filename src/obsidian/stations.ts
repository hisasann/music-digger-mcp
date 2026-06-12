import { readFile } from 'node:fs/promises';
import type { Config } from '../config.js';
import { resolveStationsPath } from './paths.js';

export function parseStationSeeds(content: string): string[] {
  const seeds: string[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('- ')) continue;
    let body = line.slice(2).trim();
    const hashAt = body.indexOf(' #');
    if (hashAt >= 0) body = body.slice(0, hashAt).trim();
    if (body) seeds.push(body);
  }
  return seeds;
}

export async function readStationSeeds(cfg: Config): Promise<string[]> {
  const path = resolveStationsPath(cfg);
  try {
    const content = await readFile(path, 'utf8');
    return parseStationSeeds(content);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

export function pickRandomSeed(seeds: string[], rng: () => number = Math.random): string | undefined {
  if (seeds.length === 0) return undefined;
  const idx = Math.floor(rng() * seeds.length);
  return seeds[idx];
}
