import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasICloudPlaceholder } from '../../src/obsidian/icloud.js';

describe('iCloud placeholder detection', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'icloud-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns false when no placeholder exists', async () => {
    const target = join(dir, 'note.md');
    writeFileSync(target, 'content');
    expect(await hasICloudPlaceholder(target)).toBe(false);
  });

  it('returns true when placeholder file exists', async () => {
    const target = join(dir, 'note.md');
    writeFileSync(join(dir, '.note.md.icloud'), '');
    expect(await hasICloudPlaceholder(target)).toBe(true);
  });
});
