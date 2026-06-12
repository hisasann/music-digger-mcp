import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleMarkCurrent } from '../../src/tools/mark-current.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
});

const playingRunnerOutput = (artist: string, album: string, track: string) =>
  `playing\x1f${artist}\x1f${album}\x1f${track}\x1f10\x1f200`;

describe('handleMarkCurrent', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('returns nothing_playing when player is stopped', async () => {
    const runner = vi.fn().mockResolvedValue('stopped\x1f\x1f\x1f\x1f\x1f');
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T21:35:00') },
    );
    expect(r).toEqual({ marked: false, reason: 'nothing_playing' });
  });

  it('writes diary and promotes when reaction is love', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('Marvin Gaye', "What's Going On", 'Inner City Blues'));
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'love', note: 'やばい' },
      { now: () => new Date('2026-06-12T21:35:00') },
    );
    expect(r.marked).toBe(true);
    expect(r.promoted).toBe(true);
    const diary = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(diary).toContain('## 21:35 — ♥ Marvin Gaye / Inner City Blues');
    const albumPath = join(vault, "music/albums/Marvin Gaye - What's Going On.md");
    expect(existsSync(albumPath)).toBe(true);
  });

  it('does not promote on a single "like"', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'like' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect(r.marked).toBe(true);
    expect(r.promoted).toBe(false);
    expect(readdirSync(join(vault, 'music/albums'))).toEqual([]);
  });

  it('promotes after two "like"s on same album across two days', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'like' }, { now: () => new Date('2026-06-10T10:00:00') });
    const r = await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'like' }, { now: () => new Date('2026-06-12T10:00:00') });
    expect(r.promoted).toBe(true);
    expect(readdirSync(join(vault, 'music/albums'))).toContain('A - B.md');
  });

  it('preserves first_marked when card already exists', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'love' }, { now: () => new Date('2026-06-10T10:00:00') });
    await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'meh' }, { now: () => new Date('2026-06-12T10:00:00') });
    const card = readFileSync(join(vault, 'music/albums/A - B.md'), 'utf8');
    expect(card).toMatch(/first_marked: 2026-06-10/);
    expect(card).toMatch(/last_marked: 2026-06-12/);
  });

  it('refuses to write when iCloud placeholder exists for diary file', async () => {
    const { mkdirSync, writeFileSync: w } = await import('node:fs');
    mkdirSync(join(vault, 'music/diary'), { recursive: true });
    w(join(vault, 'music/diary/.2026-06-12.md.icloud'), '');
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect(r).toEqual({
      marked: false,
      reason: 'icloud_placeholder',
      path: expect.stringContaining('2026-06-12.md'),
    });
  });
});
