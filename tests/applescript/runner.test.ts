import { describe, it, expect } from 'vitest';
import { runAppleScript, AppleScriptError } from '../../src/applescript/runner.js';

describe('runAppleScript (integration with real osascript)', () => {
  it('returns trimmed stdout on success', async () => {
    const out = await runAppleScript('return "hello"');
    expect(out).toBe('hello');
  });

  it('throws AppleScriptError when osascript fails', async () => {
    await expect(runAppleScript('error "boom" number 42')).rejects.toBeInstanceOf(AppleScriptError);
  });

  it('AppleScriptError carries stderr', async () => {
    try {
      await runAppleScript('error "carry this"');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppleScriptError);
      expect((e as AppleScriptError).stderr).toMatch(/carry this/);
    }
  });
});
