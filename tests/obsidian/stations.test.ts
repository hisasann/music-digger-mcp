import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseStationSeeds, readStationSeeds, pickRandomSeed } from '../../src/obsidian/stations.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
  stationsPath: 'music/stations.md',
});

describe('parseStationSeeds', () => {
  it('picks up list items as seeds', () => {
    const md = `# Stations

## Soul
- Aaron Frazer
- Curtis Harding

## HipHop
- Hip-Hop
`;
    expect(parseStationSeeds(md)).toEqual(['Aaron Frazer', 'Curtis Harding', 'Hip-Hop']);
  });

  it('ignores lines that do not start with "- "', () => {
    const md = `# Title

Plain prose here.
-noSpace
not a list - line
- valid
`;
    expect(parseStationSeeds(md)).toEqual(['valid']);
  });

  it('treats lines starting with "#" as comments / disabled', () => {
    const md = `## Active
- Aaron Frazer

## Skip
# - Lofi
`;
    expect(parseStationSeeds(md)).toEqual(['Aaron Frazer']);
  });

  it('strips inline trailing "# comment"', () => {
    const md = `- Hip-Hop  # genre tag hit
- Aaron Frazer  #soul note
- Curtis Harding
`;
    expect(parseStationSeeds(md)).toEqual(['Hip-Hop', 'Aaron Frazer', 'Curtis Harding']);
  });

  it('keeps "#" inside a seed when there is no preceding space', () => {
    const md = `- Joey Bada$$
- A#track
`;
    expect(parseStationSeeds(md)).toEqual(['Joey Bada$$', 'A#track']);
  });

  it('returns [] for empty content', () => {
    expect(parseStationSeeds('')).toEqual([]);
  });

  it('trims surrounding whitespace and tolerates indentation', () => {
    const md = `  - Aaron Frazer
\t- Curtis Harding
`;
    expect(parseStationSeeds(md)).toEqual(['Aaron Frazer', 'Curtis Harding']);
  });
});

describe('readStationSeeds', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('reads and parses the configured stations file', async () => {
    mkdirSync(join(vault, 'music'), { recursive: true });
    writeFileSync(join(vault, 'music/stations.md'), '- Aaron Frazer\n- Hip-Hop\n');
    expect(await readStationSeeds(cfg(vault))).toEqual(['Aaron Frazer', 'Hip-Hop']);
  });

  it('returns [] when the file is missing', async () => {
    expect(await readStationSeeds(cfg(vault))).toEqual([]);
  });
});

describe('pickRandomSeed', () => {
  it('returns undefined for an empty list', () => {
    expect(pickRandomSeed([])).toBeUndefined();
  });

  it('picks deterministically with an injected rng', () => {
    const seeds = ['a', 'b', 'c', 'd'];
    expect(pickRandomSeed(seeds, () => 0)).toBe('a');
    expect(pickRandomSeed(seeds, () => 0.25)).toBe('b');
    expect(pickRandomSeed(seeds, () => 0.5)).toBe('c');
    expect(pickRandomSeed(seeds, () => 0.9999)).toBe('d');
  });
});
