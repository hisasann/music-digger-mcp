import { access } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

function placeholderSibling(targetPath: string): string {
  const dir = dirname(targetPath);
  const base = basename(targetPath);
  return join(dir, `.${base}.icloud`);
}

export async function hasICloudPlaceholder(targetPath: string): Promise<boolean> {
  try {
    await access(placeholderSibling(targetPath));
    return true;
  } catch {
    return false;
  }
}
