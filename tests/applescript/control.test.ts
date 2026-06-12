import { describe, it, expect, vi } from 'vitest';
import { sendPlaybackAction, PlaybackAction } from '../../src/applescript/control.js';

describe('sendPlaybackAction', () => {
  const cases: Array<[PlaybackAction, string]> = [
    ['play', 'play'],
    ['pause', 'pause'],
    ['next', 'next track'],
    ['previous', 'previous track'],
    ['repeat_track', 'song repeat to one'],
    ['repeat_off', 'song repeat to off'],
  ];

  for (const [action, snippet] of cases) {
    it(`sends correct script for ${action}`, async () => {
      const runner = vi.fn().mockResolvedValue('playing\x1fone');
      await sendPlaybackAction(runner, action);
      expect(runner.mock.calls[0][0]).toContain(snippet);
    });
  }

  it('returns parsed state and repeat mode', async () => {
    const runner = vi.fn().mockResolvedValue('paused\x1fone');
    const r = await sendPlaybackAction(runner, 'pause');
    expect(r.ok).toBe(true);
    expect(r.state).toBe('paused');
    expect(r.repeat_mode).toBe('one');
  });

  it('falls back to safe defaults when state/repeat are unrecognized', async () => {
    const runner = vi.fn().mockResolvedValue('garbage\x1ftrash');
    const r = await sendPlaybackAction(runner, 'play');
    expect(r.state).toBe('stopped');
    expect(r.repeat_mode).toBe('off');
  });
});
