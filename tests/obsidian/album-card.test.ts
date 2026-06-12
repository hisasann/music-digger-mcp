import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shouldPromote, upsertAlbumCard } from '../../src/obsidian/album-card.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
  stationsPath: 'music/stations.md',
});

describe('shouldPromote', () => {
  it('promotes when love >= 1', () => {
    expect(shouldPromote({ love: 1, like: 0, meh: 0, skip: 0 })).toBe(true);
  });
  it('promotes when like >= 2', () => {
    expect(shouldPromote({ love: 0, like: 2, meh: 0, skip: 0 })).toBe(true);
  });
  it('does not promote when only one like', () => {
    expect(shouldPromote({ love: 0, like: 1, meh: 0, skip: 0 })).toBe(false);
  });
  it('does not promote when only meh / skip', () => {
    expect(shouldPromote({ love: 0, like: 0, meh: 5, skip: 5 })).toBe(false);
  });
});

describe('upsertAlbumCard', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('creates a new card with frontmatter when none exists', async () => {
    const path = await upsertAlbumCard(cfg(vault), {
      artist: 'Marvin Gaye',
      album: "What's Going On",
      counts: { love: 1, like: 0, meh: 0, skip: 0 },
      isoDate: '2026-06-12',
      noteLine: 'やばい',
    });
    expect(existsSync(path)).toBe(true);
    const c = readFileSync(path, 'utf8');
    expect(c).toMatch(/^---\nartist: Marvin Gaye/m);
    expect(c).toMatch(/album: What's Going On/);
    expect(c).toMatch(/first_marked: 2026-06-12/);
    expect(c).toMatch(/last_marked: 2026-06-12/);
    expect(c).toMatch(/  love: 1/);
    expect(c).toContain('- 2026-06-12: やばい');
  });

  it('preserves first_marked and updates last_marked / counts on second call', async () => {
    await upsertAlbumCard(cfg(vault), {
      artist: 'A', album: 'B', counts: { love: 1, like: 0, meh: 0, skip: 0 },
      isoDate: '2026-06-10', noteLine: 'first',
    });
    const path = await upsertAlbumCard(cfg(vault), {
      artist: 'A', album: 'B', counts: { love: 1, like: 1, meh: 0, skip: 0 },
      isoDate: '2026-06-12', noteLine: 'second',
    });
    const c = readFileSync(path, 'utf8');
    expect(c).toMatch(/first_marked: 2026-06-10/);
    expect(c).toMatch(/last_marked: 2026-06-12/);
    expect(c).toMatch(/  like: 1/);
    expect(c).toContain('- 2026-06-10: first');
    expect(c).toContain('- 2026-06-12: second');
  });

  it('sanitizes filename with slashes in artist', async () => {
    const path = await upsertAlbumCard(cfg(vault), {
      artist: 'AC/DC', album: 'Back in Black',
      counts: { love: 1, like: 0, meh: 0, skip: 0 },
      isoDate: '2026-06-12',
    });
    expect(path).toContain('AC_DC - Back in Black.md');
  });
});
