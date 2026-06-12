import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePlayStation } from '../../src/tools/play-station.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
  stationsPath: 'music/stations.md',
});

describe('handlePlayStation', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('returns playing:true with starting_track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'ok\x1fMarvin Gaye\x1fWhat\'s Going On\x1fInner City Blues'
    );
    const r = await handlePlayStation({ runner, cfg: cfg(vault) }, { seed: 'Marvin Gaye' });
    expect(r).toEqual({
      playing: true,
      seed: 'Marvin Gaye',
      starting_track: {
        artist: 'Marvin Gaye',
        album: "What's Going On",
        track: 'Inner City Blues',
      },
    });
  });

  it('returns playing:false / not_found when seed missing', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f\x1f');
    const r = await handlePlayStation({ runner, cfg: cfg(vault) }, { seed: 'Nope' });
    expect(r).toEqual({ playing: false, reason: 'not_found' });
  });

  it('returns ok:false on runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlayStation({ runner, cfg: cfg(vault) }, { seed: 'X' });
    expect((r as any).ok).toBe(false);
  });

  it('falls back to stations note when seed is omitted', async () => {
    mkdirSync(join(vault, 'music'), { recursive: true });
    writeFileSync(join(vault, 'music/stations.md'), '# Stations\n- Aaron Frazer\n- Curtis Harding\n');
    const runner = vi.fn().mockResolvedValue(
      'ok\x1fCurtis Harding\x1fIf Words Were Flowers\x1fHopeful'
    );
    const rng = () => 0.99; // -> last seed
    const r = await handlePlayStation({ runner, cfg: cfg(vault), rng }, {});
    expect(r).toEqual({
      playing: true,
      seed: 'Curtis Harding',
      starting_track: {
        artist: 'Curtis Harding',
        album: 'If Words Were Flowers',
        track: 'Hopeful',
      },
    });
    const sentScript = runner.mock.calls[0][0] as string;
    expect(sentScript).toContain('Curtis Harding');
  });

  it('returns no_seeds when stations note is missing', async () => {
    const runner = vi.fn();
    const r = await handlePlayStation({ runner, cfg: cfg(vault) }, {});
    expect(r).toEqual({ playing: false, reason: 'no_seeds' });
    expect(runner).not.toHaveBeenCalled();
  });

  it('returns no_seeds when stations note is empty', async () => {
    mkdirSync(join(vault, 'music'), { recursive: true });
    writeFileSync(join(vault, 'music/stations.md'), '# Stations\n\njust prose, no list items.\n');
    const runner = vi.fn();
    const r = await handlePlayStation({ runner, cfg: cfg(vault) }, {});
    expect(r).toEqual({ playing: false, reason: 'no_seeds' });
    expect(runner).not.toHaveBeenCalled();
  });
});
