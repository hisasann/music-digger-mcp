import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../config.js';

export function sanitizeFilename(s: string): string {
  let r = s.trim().replace(/[\/:\\]/g, '_');
  if (r.startsWith('.')) r = '_' + r;
  return r;
}

export function resolveDiaryPath(cfg: Config, isoDate: string): string {
  return join(cfg.vaultPath, cfg.diarySubdir, `${isoDate}.md`);
}

export function resolveAlbumCardPath(cfg: Config, artist: string, album: string): string {
  const filename = `${sanitizeFilename(artist)} - ${sanitizeFilename(album)}.md`;
  return join(cfg.vaultPath, cfg.albumsSubdir, filename);
}

export function resolveStationsPath(cfg: Config): string {
  return join(cfg.vaultPath, cfg.stationsPath);
}

export async function ensureSubdirs(cfg: Config): Promise<void> {
  await mkdir(join(cfg.vaultPath, cfg.diarySubdir), { recursive: true });
  await mkdir(join(cfg.vaultPath, cfg.albumsSubdir), { recursive: true });
}
