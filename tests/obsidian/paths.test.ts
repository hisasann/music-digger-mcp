import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveDiaryPath,
  resolveAlbumCardPath,
  sanitizeFilename,
  ensureSubdirs,
} from '../../src/obsidian/paths.js';

describe('sanitizeFilename', () => {
  it('replaces slashes, colons, backslashes with underscore', () => {
    expect(sanitizeFilename('A/B:C\\D')).toBe('A_B_C_D');
  });
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeFilename('  hello  ')).toBe('hello');
  });
  it('prefixes underscore when starting with dot', () => {
    expect(sanitizeFilename('.hidden')).toBe('_.hidden');
  });
});

describe('path resolvers', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('resolveDiaryPath returns <vault>/<subdir>/YYYY-MM-DD.md', () => {
    const p = resolveDiaryPath({
      vaultPath: vault,
      diarySubdir: 'music/diary',
      albumsSubdir: 'music/albums',
      stationsPath: 'music/stations.md',
    }, '2026-06-12');
    expect(p).toBe(join(vault, 'music/diary/2026-06-12.md'));
  });

  it('resolveAlbumCardPath returns sanitized <artist> - <album>.md', () => {
    const p = resolveAlbumCardPath({
      vaultPath: vault,
      diarySubdir: 'music/diary',
      albumsSubdir: 'music/albums',
      stationsPath: 'music/stations.md',
    }, 'Marvin Gaye', "What's Going On");
    expect(p).toBe(join(vault, "music/albums/Marvin Gaye - What's Going On.md"));
  });

  it('resolveAlbumCardPath sanitizes slash in artist name', () => {
    const p = resolveAlbumCardPath({
      vaultPath: vault,
      diarySubdir: 'music/diary',
      albumsSubdir: 'music/albums',
      stationsPath: 'music/stations.md',
    }, 'AC/DC', 'Back in Black');
    expect(p).toBe(join(vault, 'music/albums/AC_DC - Back in Black.md'));
  });

  it('ensureSubdirs creates diary and albums dirs', async () => {
    await ensureSubdirs({
      vaultPath: vault,
      diarySubdir: 'music/diary',
      albumsSubdir: 'music/albums',
    });
    expect(existsSync(join(vault, 'music/diary'))).toBe(true);
    expect(existsSync(join(vault, 'music/albums'))).toBe(true);
  });
});
