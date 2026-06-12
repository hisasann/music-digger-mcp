import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadConfig', () => {
  let tmpVault: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmpVault = mkdtempSync(join(tmpdir(), 'music-digger-vault-'));
  });

  afterEach(() => {
    rmSync(tmpVault, { recursive: true, force: true });
    process.env = { ...origEnv };
  });

  it('returns defaults when only OBSIDIAN_VAULT_PATH is set', async () => {
    process.env.OBSIDIAN_VAULT_PATH = tmpVault;
    delete process.env.MUSIC_DIARY_SUBDIR;
    delete process.env.MUSIC_ALBUMS_SUBDIR;

    const { loadConfig } = await import('../src/config.js');
    const cfg = loadConfig();

    expect(cfg.vaultPath).toBe(tmpVault);
    expect(cfg.diarySubdir).toBe('music/diary');
    expect(cfg.albumsSubdir).toBe('music/albums');
  });

  it('honors overrides from env', async () => {
    process.env.OBSIDIAN_VAULT_PATH = tmpVault;
    process.env.MUSIC_DIARY_SUBDIR = 'custom/diary';
    process.env.MUSIC_ALBUMS_SUBDIR = 'custom/albums';

    const { loadConfig } = await import('../src/config.js');
    const cfg = loadConfig();

    expect(cfg.diarySubdir).toBe('custom/diary');
    expect(cfg.albumsSubdir).toBe('custom/albums');
  });

  it('throws when OBSIDIAN_VAULT_PATH is missing', async () => {
    delete process.env.OBSIDIAN_VAULT_PATH;
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig()).toThrow(/OBSIDIAN_VAULT_PATH/);
  });

  it('throws when OBSIDIAN_VAULT_PATH does not exist', async () => {
    process.env.OBSIDIAN_VAULT_PATH = '/nonexistent/path/abcxyz';
    const { loadConfig } = await import('../src/config.js');
    expect(() => loadConfig()).toThrow(/does not exist/);
  });
});
