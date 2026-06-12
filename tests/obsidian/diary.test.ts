import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendDiaryEntry, parseAlbumReactions } from '../../src/obsidian/diary.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
  stationsPath: 'music/stations.md',
});

describe('appendDiaryEntry', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('creates the diary file with header when missing', async () => {
    await appendDiaryEntry(cfg(vault), {
      isoDate: '2026-06-12',
      time: '21:35',
      artist: 'Marvin Gaye',
      album: "What's Going On",
      track: 'Inner City Blues',
      reaction: 'love',
      note: 'やばい',
    });
    const content = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(content).toMatch(/^# 2026-06-12/);
    expect(content).toContain('## 21:35 — ♥ Marvin Gaye / Inner City Blues');
    expect(content).toContain("(What's Going On)");
    expect(content).toContain('love');
    expect(content).toContain('やばい');
  });

  it('appends to existing diary without duplicating header', async () => {
    await appendDiaryEntry(cfg(vault), {
      isoDate: '2026-06-12', time: '21:00', artist: 'A', album: 'B', track: 'T1', reaction: 'like',
    });
    await appendDiaryEntry(cfg(vault), {
      isoDate: '2026-06-12', time: '21:30', artist: 'A', album: 'B', track: 'T2', reaction: 'meh',
    });
    const content = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(content.match(/^# 2026-06-12/gm)?.length).toBe(1);
    expect(content).toContain('T1');
    expect(content).toContain('T2');
  });

  it('uses correct icons for each reaction', async () => {
    const reactions = ['love', 'like', 'meh', 'skip'] as const;
    for (const r of reactions) {
      await appendDiaryEntry(cfg(vault), {
        isoDate: '2026-06-12', time: '21:00', artist: 'A', album: 'B', track: r, reaction: r,
      });
    }
    const content = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(content).toContain('— ♥ A / love');
    expect(content).toContain('— ★ A / like');
    expect(content).toContain('— A / meh');
    expect(content).toContain('— × A / skip');
  });
});

describe('parseAlbumReactions', () => {
  it('counts reactions for a specific album from diaries', () => {
    const diaryA = `# 2026-06-10

## 12:00 — ♥ Marvin Gaye / Inner City Blues (What's Going On)
love
`;
    const diaryB = `# 2026-06-12

## 21:00 — ★ Marvin Gaye / What Happening Brother (What's Going On)
like

## 22:00 — × Other / Song (Other Album)
skip
`;
    const counts = parseAlbumReactions([diaryA, diaryB], 'Marvin Gaye', "What's Going On");
    expect(counts).toEqual({ love: 1, like: 1, meh: 0, skip: 0 });
  });

  it('returns zeros when no entries match', () => {
    const counts = parseAlbumReactions(['# 2026-06-12\n'], 'X', 'Y');
    expect(counts).toEqual({ love: 0, like: 0, meh: 0, skip: 0 });
  });
});
