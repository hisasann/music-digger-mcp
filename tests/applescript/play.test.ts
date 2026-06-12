import { describe, it, expect, vi } from 'vitest';
import { playAlbumByName, playStationFromSeed } from '../../src/applescript/play.js';

describe('playAlbumByName', () => {
  it('returns the started track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'ok\x1fMarvin Gaye\x1fWhat\'s Going On\x1fWhat\'s Going On'
    );
    const r = await playAlbumByName(runner, 'Marvin Gaye', "What's Going On");
    expect(r).toEqual({
      ok: true,
      artist: 'Marvin Gaye',
      album: "What's Going On",
      first_track: "What's Going On",
    });
  });

  it('returns ok=false when album not found', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f');
    const r = await playAlbumByName(runner, 'X', 'Y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('escapes double quotes in artist/album', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f');
    await playAlbumByName(runner, 'Sly "Stone"', 'Greatest "Hits"');
    const sent = runner.mock.calls[0][0] as string;
    expect(sent).toContain('Sly \\"Stone\\"');
    expect(sent).toContain('Greatest \\"Hits\\"');
  });

  it('escapes backslashes in artist/album', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f');
    await playAlbumByName(runner, 'Foo\\Bar', 'Album\\X');
    const sent = runner.mock.calls[0][0] as string;
    expect(sent).toContain('Foo\\\\Bar');
    expect(sent).toContain('Album\\\\X');
  });

  it('returns not_found when output is truncated', async () => {
    const runner = vi.fn().mockResolvedValue('ok');
    const r = await playAlbumByName(runner, 'A', 'B');
    expect(r.ok).toBe(false);
  });
});

describe('playStationFromSeed', () => {
  it('returns the starting track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'ok\x1fMarvin Gaye\x1fWhat\'s Going On\x1fInner City Blues'
    );
    const r = await playStationFromSeed(runner, 'Marvin Gaye');
    expect(r).toEqual({
      ok: true,
      seed: 'Marvin Gaye',
      starting_track: { artist: 'Marvin Gaye', album: "What's Going On", track: 'Inner City Blues' },
    });
  });

  it('returns ok=false when seed not found', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f\x1f');
    const r = await playStationFromSeed(runner, 'Nonexistent');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('escapes double quotes and backslashes in seed', async () => {
    const runner = vi.fn().mockResolvedValue('not_found\x1f\x1f\x1f\x1f');
    await playStationFromSeed(runner, 'Foo "Bar"\\baz');
    const sent = runner.mock.calls[0][0] as string;
    expect(sent).toContain('Foo \\"Bar\\"\\\\baz');
  });

  it('returns not_found when station output is truncated', async () => {
    const runner = vi.fn().mockResolvedValue('ok');
    const r = await playStationFromSeed(runner, 'X');
    expect(r.ok).toBe(false);
  });
});
