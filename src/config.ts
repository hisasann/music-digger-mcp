import { existsSync, statSync } from 'node:fs';

export interface Config {
  vaultPath: string;
  diarySubdir: string;
  albumsSubdir: string;
}

export function loadConfig(): Config {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) {
    throw new Error('OBSIDIAN_VAULT_PATH is required');
  }
  if (!existsSync(vaultPath) || !statSync(vaultPath).isDirectory()) {
    throw new Error(`OBSIDIAN_VAULT_PATH does not exist or is not a directory: ${vaultPath}`);
  }
  return {
    vaultPath,
    diarySubdir: process.env.MUSIC_DIARY_SUBDIR ?? 'music/diary',
    albumsSubdir: process.env.MUSIC_ALBUMS_SUBDIR ?? 'music/albums',
  };
}
