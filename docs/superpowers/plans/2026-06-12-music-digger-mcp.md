# music-digger-mcp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apple Music を Claude Code から自然言語で扱える MCP サーバーを作る。ステーション/アルバム再生と再生制御を提供し、ユーザーが反応した曲だけを Obsidian Vault に蓄積する。

**Architecture:** TypeScript で `@modelcontextprotocol/sdk` を使った stdio ベースの MCP サーバー。Apple Music 操作は AppleScript（`osascript`）の薄いラッパ越し、Obsidian Vault への書き込みは `fs/promises`。MCP は道具に徹し、選曲判断は Claude Code 側の LLM に委ねる。

**Tech Stack:** Node.js (LTS) / TypeScript / `@modelcontextprotocol/sdk` / Vitest / `child_process.spawn` / `fs/promises` / `yaml`

**Spec:** `docs/superpowers/specs/2026-06-12-music-digger-mcp-design.md`

---

## File Structure

```
music-digger-mcp/
├── src/
│   ├── index.ts                    # MCP サーバーエントリ
│   ├── config.ts                   # 環境変数の集約
│   ├── tools/
│   │   ├── current-track.ts        # current_track ツール
│   │   ├── play-album.ts           # play_album ツール
│   │   ├── play-station.ts         # play_station ツール
│   │   ├── playback-control.ts     # playback_control ツール
│   │   └── mark-current.ts         # mark_current ツール
│   ├── applescript/
│   │   ├── runner.ts               # osascript 実行ヘルパ（DI 可能）
│   │   ├── current.ts              # 現在曲取得
│   │   ├── play.ts                 # アルバム/ステーション再生
│   │   └── control.ts              # 再生制御
│   └── obsidian/
│       ├── paths.ts                # Vault パス解決、mkdir -p
│       ├── icloud.ts               # iCloud placeholder 検出
│       ├── diary.ts                # 日記追記
│       └── album-card.ts           # カード生成・昇格判定
├── tests/                          # src と同じディレクトリ構造でミラー
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .gitignore
```

ファイル名はすべて小文字、kebab-case で統一する。

---

## Phase 1: 基盤

### Task 1: プロジェクト初期化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts` (placeholder)

- [ ] **Step 1: Initialize npm project and install deps**

```bash
cd /Users/hisasann/_/ai/music-digger-mcp
npm init -y
npm install @modelcontextprotocol/sdk yaml
npm install -D typescript tsx vitest @types/node
```

- [ ] **Step 2: Write `package.json` (overwrite generated one)**

```json
{
  "name": "music-digger-mcp",
  "version": "0.1.0",
  "description": "MCP server for Apple Music + Obsidian music discovery logging",
  "type": "module",
  "main": "build/index.js",
  "bin": {
    "music-digger-mcp": "build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node build/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "yaml": "^2.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "build",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
build/
*.log
.DS_Store
```

- [ ] **Step 6: Create placeholder `src/index.ts`**

```typescript
console.log('music-digger-mcp placeholder');
```

- [ ] **Step 7: Verify build and test scaffolding work**

Run: `npm run build`
Expected: PASS (build/ directory created with index.js)

Run: `npm test`
Expected: PASS with "No test files found" (0 tests, exit 0 because vitest run is permissive of empty)

If vitest exits non-zero on no tests, create a trivial passing test as `tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('runs', () => { expect(1).toBe(1); }); });
```

Run: `npm test`
Expected: 1 passing

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold TypeScript + vitest project"
```

---

### Task 2: 環境変数モジュール (`src/config.ts`)

**Files:**
- Create: `src/config.ts`
- Test: `tests/config.test.ts`

`config.ts` は環境変数を読み、Vault パスの存在確認まで行う。デフォルト値も与える。

- [ ] **Step 1: Write the failing test**

`tests/config.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config.test.ts`
Expected: FAIL (`config.js` does not exist)

- [ ] **Step 3: Write minimal implementation**

`src/config.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config.test.ts`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(config): load Vault path and subdirs from env"
```

---

## Phase 2: AppleScript レイヤ

### Task 3: AppleScript runner (`src/applescript/runner.ts`)

osascript を `child_process.spawn` で呼び出し、stdout を返す薄いラッパ。テスト時に差し替えられるように関数型で設計する。

**Files:**
- Create: `src/applescript/runner.ts`
- Test: `tests/applescript/runner.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/applescript/runner.test.ts`:

```typescript
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
```

注: このテストは macOS の `osascript` を呼ぶ実環境テスト。CI 上で skip するなら `it.skipIf(process.platform !== 'darwin')` を使う。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/applescript/runner.test.ts`
Expected: FAIL (`runner.js` does not exist)

- [ ] **Step 3: Write minimal implementation**

`src/applescript/runner.ts`:

```typescript
import { spawn } from 'node:child_process';

export class AppleScriptError extends Error {
  constructor(message: string, public stderr: string, public exitCode: number | null) {
    super(message);
    this.name = 'AppleScriptError';
  }
}

export type AppleScriptRunner = (script: string) => Promise<string>;

export const runAppleScript: AppleScriptRunner = (script) => {
  return new Promise((resolve, reject) => {
    const child = spawn('osascript', ['-e', script]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new AppleScriptError(`osascript exited with code ${code}`, stderr.trim(), code));
      }
    });
  });
};
```

- [ ] **Step 4: Run test to verify it passes (macOS)**

Run: `npm test -- tests/applescript/runner.test.ts`
Expected: 3 passing on macOS

- [ ] **Step 5: Commit**

```bash
git add src/applescript/runner.ts tests/applescript/runner.test.ts
git commit -m "feat(applescript): add osascript runner with structured errors"
```

---

### Task 4: AppleScript current track (`src/applescript/current.ts`)

現在再生中の曲情報を取得する。DI で runner を受け取って単体テスト可能に。

**Files:**
- Create: `src/applescript/current.ts`
- Test: `tests/applescript/current.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/applescript/current.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getCurrentTrack } from '../../src/applescript/current.js';

describe('getCurrentTrack', () => {
  it('parses delimited osascript output into a struct', async () => {
    const runner = vi.fn().mockResolvedValue(
      'playingMarvin GayeWhat's Going OnInner City Blues120300'
    );
    const result = await getCurrentTrack(runner);
    expect(result).toEqual({
      playing: true,
      artist: 'Marvin Gaye',
      album: "What's Going On",
      track: 'Inner City Blues',
      position: 120,
      duration: 300,
    });
  });

  it('returns playing=false when nothing is playing', async () => {
    const runner = vi.fn().mockResolvedValue('stopped');
    const result = await getCurrentTrack(runner);
    expect(result.playing).toBe(false);
    expect(result.artist).toBeUndefined();
  });

  it('treats "paused" state as playing=false but keeps track info', async () => {
    const runner = vi.fn().mockResolvedValue(
      'pausedArtistAlbumTrack10200'
    );
    const result = await getCurrentTrack(runner);
    expect(result.playing).toBe(false);
    expect(result.artist).toBe('Artist');
    expect(result.album).toBe('Album');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/applescript/current.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/applescript/current.ts`:

```typescript
import type { AppleScriptRunner } from './runner.js';

export interface CurrentTrack {
  playing: boolean;
  artist?: string;
  album?: string;
  track?: string;
  position?: number;
  duration?: number;
}

const SEP = '';

const SCRIPT = `
tell application "Music"
  if it is running then
    set st to player state as string
    if st is "playing" or st is "paused" then
      set tr to current track
      set a to artist of tr
      set al to album of tr
      set t to name of tr
      set p to player position
      set d to duration of tr
      return st & "${SEP}" & a & "${SEP}" & al & "${SEP}" & t & "${SEP}" & p & "${SEP}" & d
    else
      return st & "${SEP}${SEP}${SEP}${SEP}${SEP}"
    end if
  else
    return "stopped${SEP}${SEP}${SEP}${SEP}${SEP}"
  end if
end tell
`;

export async function getCurrentTrack(runner: AppleScriptRunner): Promise<CurrentTrack> {
  const out = await runner(SCRIPT);
  const [state, artist, album, track, posStr, durStr] = out.split(SEP);
  if (state !== 'playing' && state !== 'paused') {
    return { playing: false };
  }
  return {
    playing: state === 'playing',
    artist: artist || undefined,
    album: album || undefined,
    track: track || undefined,
    position: posStr ? Number(posStr) : undefined,
    duration: durStr ? Number(durStr) : undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/applescript/current.test.ts`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/applescript/current.ts tests/applescript/current.test.ts
git commit -m "feat(applescript): get current Music.app track via delimited output"
```

---

### Task 5: AppleScript play album / station (`src/applescript/play.ts`)

`play_album` と `play_station` の元になる AppleScript。

**Files:**
- Create: `src/applescript/play.ts`
- Test: `tests/applescript/play.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/applescript/play.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { playAlbumByName, playStationFromSeed } from '../../src/applescript/play.js';

describe('playAlbumByName', () => {
  it('returns the started track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'okMarvin GayeWhat's Going OnWhat's Going On'
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
    const runner = vi.fn().mockResolvedValue('not_found');
    const r = await playAlbumByName(runner, 'X', 'Y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });

  it('escapes double quotes in artist/album', async () => {
    const runner = vi.fn().mockResolvedValue('not_found');
    await playAlbumByName(runner, 'Sly "Stone"', 'Greatest "Hits"');
    const sent = runner.mock.calls[0][0] as string;
    expect(sent).toContain('Sly \\"Stone\\"');
    expect(sent).toContain('Greatest \\"Hits\\"');
  });
});

describe('playStationFromSeed', () => {
  it('returns the starting track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'okMarvin GayeWhat's Going OnInner City Blues'
    );
    const r = await playStationFromSeed(runner, 'Marvin Gaye');
    expect(r).toEqual({
      ok: true,
      seed: 'Marvin Gaye',
      starting_track: { artist: 'Marvin Gaye', album: "What's Going On", track: 'Inner City Blues' },
    });
  });

  it('returns ok=false when seed not found', async () => {
    const runner = vi.fn().mockResolvedValue('not_found');
    const r = await playStationFromSeed(runner, 'Nonexistent');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not_found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/applescript/play.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/applescript/play.ts`:

```typescript
import type { AppleScriptRunner } from './runner.js';

const SEP = '';

export type PlayAlbumResult =
  | { ok: true; artist: string; album: string; first_track: string }
  | { ok: false; reason: 'not_found' };

export type PlayStationResult =
  | { ok: true; seed: string; starting_track: { artist: string; album: string; track: string } }
  | { ok: false; reason: 'not_found' };

function escapeDoubleQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

export async function playAlbumByName(
  runner: AppleScriptRunner,
  artist: string,
  album: string,
): Promise<PlayAlbumResult> {
  const script = `
tell application "Music"
  set hits to (every track of library playlist 1 whose artist is "${escapeDoubleQuotes(artist)}" and album is "${escapeDoubleQuotes(album)}")
  if (count of hits) is 0 then
    return "not_found${SEP}${SEP}${SEP}"
  end if
  set firstTrack to item 1 of hits
  play firstTrack
  return "ok${SEP}" & (artist of firstTrack) & "${SEP}" & (album of firstTrack) & "${SEP}" & (name of firstTrack)
end tell
`;
  const out = await runner(script);
  const [status, a, al, t] = out.split(SEP);
  if (status !== 'ok') return { ok: false, reason: 'not_found' };
  return { ok: true, artist: a, album: al, first_track: t };
}

export async function playStationFromSeed(
  runner: AppleScriptRunner,
  seed: string,
): Promise<PlayStationResult> {
  const script = `
tell application "Music"
  set seedHits to (every track whose artist contains "${escapeDoubleQuotes(seed)}" or genre contains "${escapeDoubleQuotes(seed)}")
  if (count of seedHits) is 0 then
    return "not_found${SEP}${SEP}${SEP}${SEP}"
  end if
  set seedTrack to item 1 of seedHits
  play seedTrack
  try
    tell seedTrack to reveal
    set song station of front window to true
  on error
    -- station start is best-effort; fall back to plain playback
  end try
  return "ok${SEP}" & (artist of seedTrack) & "${SEP}" & (album of seedTrack) & "${SEP}" & (name of seedTrack)
end tell
`;
  const out = await runner(script);
  const [status, artist, album, track] = out.split(SEP);
  if (status !== 'ok') return { ok: false, reason: 'not_found' };
  return { ok: true, seed, starting_track: { artist, album, track } };
}
```

注: ステーション起動の AppleScript は Music.app のバージョンによってサポート状況が変わる。MVP では「seed の曲を再生開始」までは保証し、ステーション化が失敗してもエラーにしない best-effort 設計。実機検証で動かない場合は、`make station` 系の別構文に差し替える。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/applescript/play.test.ts`
Expected: 5 passing

- [ ] **Step 5: Commit**

```bash
git add src/applescript/play.ts tests/applescript/play.test.ts
git commit -m "feat(applescript): play album by name and start station from seed"
```

---

### Task 6: AppleScript playback control (`src/applescript/control.ts`)

**Files:**
- Create: `src/applescript/control.ts`
- Test: `tests/applescript/control.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/applescript/control.test.ts`:

```typescript
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
      const runner = vi.fn().mockResolvedValue('playingone');
      await sendPlaybackAction(runner, action);
      expect(runner.mock.calls[0][0]).toContain(snippet);
    });
  }

  it('returns parsed state and repeat mode', async () => {
    const runner = vi.fn().mockResolvedValue('pausedone');
    const r = await sendPlaybackAction(runner, 'pause');
    expect(r.ok).toBe(true);
    expect(r.state).toBe('paused');
    expect(r.repeat_mode).toBe('one');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/applescript/control.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/applescript/control.ts`:

```typescript
import type { AppleScriptRunner } from './runner.js';

const SEP = '';

export type PlaybackAction =
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'repeat_track'
  | 'repeat_off';

export type PlaybackState = 'playing' | 'paused' | 'stopped';
export type RepeatMode = 'off' | 'one' | 'all';

export interface PlaybackResult {
  ok: true;
  state: PlaybackState;
  repeat_mode: RepeatMode;
}

function actionScriptBody(action: PlaybackAction): string {
  switch (action) {
    case 'play': return 'if player state is paused or player state is stopped then play';
    case 'pause': return 'pause';
    case 'next': return 'next track';
    case 'previous': return 'previous track';
    case 'repeat_track': return 'set song repeat to one';
    case 'repeat_off': return 'set song repeat to off';
  }
}

export async function sendPlaybackAction(
  runner: AppleScriptRunner,
  action: PlaybackAction,
): Promise<PlaybackResult> {
  const body = actionScriptBody(action);
  const script = `
tell application "Music"
  ${body}
  set st to player state as string
  set rm to song repeat as string
  return st & "${SEP}" & rm
end tell
`;
  const out = await runner(script);
  const [state, repeat] = out.split(SEP);
  return {
    ok: true,
    state: state as PlaybackState,
    repeat_mode: repeat as RepeatMode,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/applescript/control.test.ts`
Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add src/applescript/control.ts tests/applescript/control.test.ts
git commit -m "feat(applescript): playback control (play/pause/next/prev/repeat)"
```

---

## Phase 3: Obsidian レイヤ

### Task 7: Obsidian paths (`src/obsidian/paths.ts`)

Vault パス解決、サブディレクトリの mkdir、ファイル名サニタイズ。

**Files:**
- Create: `src/obsidian/paths.ts`
- Test: `tests/obsidian/paths.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/obsidian/paths.test.ts`:

```typescript
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
    }, '2026-06-12');
    expect(p).toBe(join(vault, 'music/diary/2026-06-12.md'));
  });

  it('resolveAlbumCardPath returns sanitized <artist> - <album>.md', () => {
    const p = resolveAlbumCardPath({
      vaultPath: vault,
      diarySubdir: 'music/diary',
      albumsSubdir: 'music/albums',
    }, 'Marvin Gaye', "What's Going On");
    expect(p).toBe(join(vault, "music/albums/Marvin Gaye - What's Going On.md"));
  });

  it('resolveAlbumCardPath sanitizes slash in artist name', () => {
    const p = resolveAlbumCardPath({
      vaultPath: vault,
      diarySubdir: 'music/diary',
      albumsSubdir: 'music/albums',
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/obsidian/paths.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/obsidian/paths.ts`:

```typescript
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

export async function ensureSubdirs(cfg: Config): Promise<void> {
  await mkdir(join(cfg.vaultPath, cfg.diarySubdir), { recursive: true });
  await mkdir(join(cfg.vaultPath, cfg.albumsSubdir), { recursive: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/obsidian/paths.test.ts`
Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/paths.ts tests/obsidian/paths.test.ts
git commit -m "feat(obsidian): path resolvers, mkdir helpers, filename sanitizer"
```

---

### Task 8: iCloud placeholder 検出 (`src/obsidian/icloud.ts`)

iCloud 同期中の placeholder ファイル（`.icloud` 拡張子）を検出し、警告を返す。

**Files:**
- Create: `src/obsidian/icloud.ts`
- Test: `tests/obsidian/icloud.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/obsidian/icloud.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/obsidian/icloud.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/obsidian/icloud.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/obsidian/icloud.test.ts`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/icloud.ts tests/obsidian/icloud.test.ts
git commit -m "feat(obsidian): detect iCloud placeholder files"
```

---

### Task 9: Diary 追記 (`src/obsidian/diary.ts`)

その日の日記ファイルに反応エントリを追記する。日付は呼び出し側から渡す（テストしやすいように）。

**Files:**
- Create: `src/obsidian/diary.ts`
- Test: `tests/obsidian/diary.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/obsidian/diary.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendDiaryEntry, parseAlbumReactions } from '../../src/obsidian/diary.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
});

describe('appendDiaryEntry', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('creates the diary file with header when missing', async () => {
    await appendDiaryEntry(cfg(vault), {
      isoDate: '2026-06-12',
      time: '21:35',
      artist: 'Marvin Gaye',
      album: "What's Going On",
      track: 'Inner City Blues',
      reaction: 'love',
      note: 'やばい',
    });
    const content = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(content).toMatch(/^# 2026-06-12/);
    expect(content).toContain('## 21:35 — ♥ Marvin Gaye / Inner City Blues');
    expect(content).toContain("(What's Going On)");
    expect(content).toContain('love');
    expect(content).toContain('やばい');
  });

  it('appends to existing diary without duplicating header', async () => {
    await appendDiaryEntry(cfg(vault), {
      isoDate: '2026-06-12', time: '21:00', artist: 'A', album: 'B', track: 'T1', reaction: 'like',
    });
    await appendDiaryEntry(cfg(vault), {
      isoDate: '2026-06-12', time: '21:30', artist: 'A', album: 'B', track: 'T2', reaction: 'meh',
    });
    const content = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(content.match(/^# 2026-06-12/gm)?.length).toBe(1);
    expect(content).toContain('T1');
    expect(content).toContain('T2');
  });

  it('uses correct icons for each reaction', async () => {
    const reactions = ['love', 'like', 'meh', 'skip'] as const;
    for (const r of reactions) {
      await appendDiaryEntry(cfg(vault), {
        isoDate: '2026-06-12', time: '21:00', artist: 'A', album: 'B', track: r, reaction: r,
      });
    }
    const content = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(content).toContain('— ♥ A / love');
    expect(content).toContain('— ★ A / like');
    expect(content).toContain('— A / meh');
    expect(content).toContain('— × A / skip');
  });
});

describe('parseAlbumReactions', () => {
  it('counts reactions for a specific album from diaries', () => {
    const diaryA = `# 2026-06-10

## 12:00 — ♥ Marvin Gaye / Inner City Blues (What's Going On)
love
`;
    const diaryB = `# 2026-06-12

## 21:00 — ★ Marvin Gaye / What Happening Brother (What's Going On)
like

## 22:00 — × Other / Song (Other Album)
skip
`;
    const counts = parseAlbumReactions([diaryA, diaryB], 'Marvin Gaye', "What's Going On");
    expect(counts).toEqual({ love: 1, like: 1, meh: 0, skip: 0 });
  });

  it('returns zeros when no entries match', () => {
    const counts = parseAlbumReactions(['# 2026-06-12\n'], 'X', 'Y');
    expect(counts).toEqual({ love: 0, like: 0, meh: 0, skip: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/obsidian/diary.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/obsidian/diary.ts`:

```typescript
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Config } from '../config.js';
import { resolveDiaryPath } from './paths.js';

export type Reaction = 'love' | 'like' | 'meh' | 'skip';

const ICON: Record<Reaction, string> = {
  love: '♥ ',
  like: '★ ',
  meh: '',
  skip: '× ',
};

export interface DiaryEntry {
  isoDate: string;
  time: string;
  artist: string;
  album: string;
  track: string;
  reaction: Reaction;
  note?: string;
}

function formatEntry(e: DiaryEntry): string {
  const icon = ICON[e.reaction];
  const header = `## ${e.time} — ${icon}${e.artist} / ${e.track} (${e.album})`;
  const lines = [header, e.reaction];
  if (e.note) lines.push(`- "${e.note}"`);
  return lines.join('\n') + '\n';
}

export async function appendDiaryEntry(cfg: Config, entry: DiaryEntry): Promise<string> {
  const path = resolveDiaryPath(cfg, entry.isoDate);
  await mkdir(dirname(path), { recursive: true });

  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch {
    // new file
  }

  const header = existing ? '' : `# ${entry.isoDate}\n\n`;
  const separator = existing && !existing.endsWith('\n\n') ? '\n' : '';
  const next = existing + header + separator + formatEntry(entry);
  await writeFile(path, next, 'utf8');
  return path;
}

const ENTRY_HEADER_RE = /^## \d{2}:\d{2} — (?:[♥★×] )?(.+?) \/ (.+?) \((.+?)\)$/gm;

export function parseAlbumReactions(
  diaryContents: string[],
  artist: string,
  album: string,
): Record<Reaction, number> {
  const counts: Record<Reaction, number> = { love: 0, like: 0, meh: 0, skip: 0 };
  for (const content of diaryContents) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const headerMatch = lines[i].match(/^## \d{2}:\d{2} — (?:[♥★×] )?(.+?) \/ (.+?) \((.+?)\)$/);
      if (!headerMatch) continue;
      const [, a, , al] = headerMatch;
      if (a !== artist || al !== album) continue;
      const reactionLine = lines[i + 1]?.trim();
      if (reactionLine === 'love' || reactionLine === 'like' || reactionLine === 'meh' || reactionLine === 'skip') {
        counts[reactionLine]++;
      }
    }
  }
  return counts;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/obsidian/diary.test.ts`
Expected: 5 passing

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/diary.ts tests/obsidian/diary.test.ts
git commit -m "feat(obsidian): append reaction entries to dated diary file"
```

---

### Task 10: Album card 生成・昇格判定 (`src/obsidian/album-card.ts`)

`mark_current` から呼ばれる。日記の集計結果を見てカード生成/更新を決める。

**Files:**
- Create: `src/obsidian/album-card.ts`
- Test: `tests/obsidian/album-card.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/obsidian/album-card.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shouldPromote, upsertAlbumCard } from '../../src/obsidian/album-card.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
});

describe('shouldPromote', () => {
  it('promotes when love >= 1', () => {
    expect(shouldPromote({ love: 1, like: 0, meh: 0, skip: 0 })).toBe(true);
  });
  it('promotes when like >= 2', () => {
    expect(shouldPromote({ love: 0, like: 2, meh: 0, skip: 0 })).toBe(true);
  });
  it('does not promote when only one like', () => {
    expect(shouldPromote({ love: 0, like: 1, meh: 0, skip: 0 })).toBe(false);
  });
  it('does not promote when only meh / skip', () => {
    expect(shouldPromote({ love: 0, like: 0, meh: 5, skip: 5 })).toBe(false);
  });
});

describe('upsertAlbumCard', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('creates a new card with frontmatter when none exists', async () => {
    const path = await upsertAlbumCard(cfg(vault), {
      artist: 'Marvin Gaye',
      album: "What's Going On",
      counts: { love: 1, like: 0, meh: 0, skip: 0 },
      isoDate: '2026-06-12',
      noteLine: 'やばい',
    });
    expect(existsSync(path)).toBe(true);
    const c = readFileSync(path, 'utf8');
    expect(c).toMatch(/^---\nartist: Marvin Gaye/m);
    expect(c).toMatch(/album: What's Going On/);
    expect(c).toMatch(/first_marked: 2026-06-12/);
    expect(c).toMatch(/last_marked: 2026-06-12/);
    expect(c).toMatch(/  love: 1/);
    expect(c).toContain('- 2026-06-12: やばい');
  });

  it('preserves first_marked and updates last_marked / counts on second call', async () => {
    await upsertAlbumCard(cfg(vault), {
      artist: 'A', album: 'B', counts: { love: 1, like: 0, meh: 0, skip: 0 },
      isoDate: '2026-06-10', noteLine: 'first',
    });
    const path = await upsertAlbumCard(cfg(vault), {
      artist: 'A', album: 'B', counts: { love: 1, like: 1, meh: 0, skip: 0 },
      isoDate: '2026-06-12', noteLine: 'second',
    });
    const c = readFileSync(path, 'utf8');
    expect(c).toMatch(/first_marked: 2026-06-10/);
    expect(c).toMatch(/last_marked: 2026-06-12/);
    expect(c).toMatch(/  like: 1/);
    expect(c).toContain('- 2026-06-10: first');
    expect(c).toContain('- 2026-06-12: second');
  });

  it('sanitizes filename with slashes in artist', async () => {
    const path = await upsertAlbumCard(cfg(vault), {
      artist: 'AC/DC', album: 'Back in Black',
      counts: { love: 1, like: 0, meh: 0, skip: 0 },
      isoDate: '2026-06-12',
    });
    expect(path).toContain('AC_DC - Back in Black.md');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/obsidian/album-card.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/obsidian/album-card.ts`:

```typescript
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Config } from '../config.js';
import { resolveAlbumCardPath } from './paths.js';
import type { Reaction } from './diary.js';

export type ReactionCounts = Record<Reaction, number>;

export function shouldPromote(counts: ReactionCounts): boolean {
  return counts.love >= 1 || counts.like >= 2;
}

export interface UpsertCardInput {
  artist: string;
  album: string;
  counts: ReactionCounts;
  isoDate: string;
  noteLine?: string;
}

interface CardFrontmatter {
  artist: string;
  album: string;
  reactions: ReactionCounts;
  first_marked: string;
  last_marked: string;
}

function splitFrontmatter(content: string): { fm: CardFrontmatter | null; body: string } {
  if (!content.startsWith('---\n')) return { fm: null, body: content };
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { fm: null, body: content };
  const fmRaw = content.slice(4, end);
  const body = content.slice(end + 5);
  try {
    return { fm: parseYaml(fmRaw) as CardFrontmatter, body };
  } catch {
    return { fm: null, body: content };
  }
}

function joinFrontmatter(fm: CardFrontmatter, body: string): string {
  return '---\n' + stringifyYaml(fm) + '---\n' + body;
}

export async function upsertAlbumCard(cfg: Config, input: UpsertCardInput): Promise<string> {
  const path = resolveAlbumCardPath(cfg, input.artist, input.album);
  await mkdir(dirname(path), { recursive: true });

  let existing = '';
  try { existing = await readFile(path, 'utf8'); } catch { /* new */ }

  const { fm: existingFm, body: existingBody } = splitFrontmatter(existing);

  const fm: CardFrontmatter = {
    artist: input.artist,
    album: input.album,
    reactions: input.counts,
    first_marked: existingFm?.first_marked ?? input.isoDate,
    last_marked: input.isoDate,
  };

  let body = existingBody.trimStart();
  if (!body) body = '\n';
  if (input.noteLine) {
    if (!body.endsWith('\n')) body += '\n';
    body += `- ${input.isoDate}: ${input.noteLine}\n`;
  }

  await writeFile(path, joinFrontmatter(fm, body), 'utf8');
  return path;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/obsidian/album-card.test.ts`
Expected: 7 passing

- [ ] **Step 5: Commit**

```bash
git add src/obsidian/album-card.ts tests/obsidian/album-card.test.ts
git commit -m "feat(obsidian): upsert album card with promotion rule (love>=1 or like>=2)"
```

---

## Phase 4: MCP ツール

各 MCP ツールは、`@modelcontextprotocol/sdk` の Tool 定義として実装する。共通パターンは「runner と config を注入できる純粋関数」+「stdio 経由のツールハンドラ」の2層構造で書く。これで純粋関数部分を vitest で網羅でき、ハンドラ部分は薄いアダプタになる。

### Task 11: `current_track` ツール (`src/tools/current-track.ts`)

**Files:**
- Create: `src/tools/current-track.ts`
- Test: `tests/tools/current-track.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/tools/current-track.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handleCurrentTrack } from '../../src/tools/current-track.js';

describe('handleCurrentTrack', () => {
  it('returns parsed track info on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'playingMarvin GayeWhat's Going OnInner City Blues10200'
    );
    const r = await handleCurrentTrack({ runner });
    expect(r.playing).toBe(true);
    expect(r.artist).toBe('Marvin Gaye');
  });

  it('returns ok:false with music_app_unavailable when runner throws', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('osascript boom'));
    const r = await handleCurrentTrack({ runner });
    expect(r).toEqual({
      ok: false,
      error: { code: 'music_app_unavailable', message: expect.any(String) },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/current-track.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/tools/current-track.ts`:

```typescript
import type { AppleScriptRunner } from '../applescript/runner.js';
import { getCurrentTrack, type CurrentTrack } from '../applescript/current.js';

export interface ToolDeps { runner: AppleScriptRunner; }
export type ToolError = { ok: false; error: { code: string; message: string } };

export async function handleCurrentTrack(deps: ToolDeps): Promise<CurrentTrack | ToolError> {
  try {
    return await getCurrentTrack(deps.runner);
  } catch (e) {
    return {
      ok: false,
      error: { code: 'music_app_unavailable', message: (e as Error).message },
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/current-track.test.ts`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/current-track.ts tests/tools/current-track.test.ts
git commit -m "feat(tools): current_track handler with structured error"
```

---

### Task 12: `play_album` ツール (`src/tools/play-album.ts`)

**Files:**
- Create: `src/tools/play-album.ts`
- Test: `tests/tools/play-album.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/tools/play-album.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handlePlayAlbum } from '../../src/tools/play-album.js';

describe('handlePlayAlbum', () => {
  it('returns playing:true on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'okMarvin GayeWhat's Going OnWhat's Going On'
    );
    const r = await handlePlayAlbum({ runner }, { artist: 'Marvin Gaye', album: "What's Going On" });
    expect(r).toEqual({
      playing: true,
      artist: 'Marvin Gaye',
      album: "What's Going On",
      first_track: "What's Going On",
    });
  });

  it('returns playing:false / not_found when AppleScript reports missing', async () => {
    const runner = vi.fn().mockResolvedValue('not_found');
    const r = await handlePlayAlbum({ runner }, { artist: 'X', album: 'Y' });
    expect(r).toEqual({ playing: false, reason: 'not_found' });
  });

  it('returns ok:false on AppleScript runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlayAlbum({ runner }, { artist: 'A', album: 'B' });
    expect((r as any).ok).toBe(false);
    expect((r as any).error.code).toBe('music_app_unavailable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/play-album.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/tools/play-album.ts`:

```typescript
import { playAlbumByName } from '../applescript/play.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlayAlbumInput { artist: string; album: string; }
export type PlayAlbumOutput =
  | { playing: true; artist: string; album: string; first_track: string }
  | { playing: false; reason: 'not_found' }
  | ToolError;

export async function handlePlayAlbum(
  deps: ToolDeps,
  input: PlayAlbumInput,
): Promise<PlayAlbumOutput> {
  try {
    const r = await playAlbumByName(deps.runner, input.artist, input.album);
    if (r.ok) return { playing: true, artist: r.artist, album: r.album, first_track: r.first_track };
    return { playing: false, reason: r.reason };
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/play-album.test.ts`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/play-album.ts tests/tools/play-album.test.ts
git commit -m "feat(tools): play_album handler"
```

---

### Task 13: `play_station` ツール (`src/tools/play-station.ts`)

**Files:**
- Create: `src/tools/play-station.ts`
- Test: `tests/tools/play-station.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/tools/play-station.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handlePlayStation } from '../../src/tools/play-station.js';

describe('handlePlayStation', () => {
  it('returns playing:true with starting_track on success', async () => {
    const runner = vi.fn().mockResolvedValue(
      'okMarvin GayeWhat's Going OnInner City Blues'
    );
    const r = await handlePlayStation({ runner }, { seed: 'Marvin Gaye' });
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
    const runner = vi.fn().mockResolvedValue('not_found');
    const r = await handlePlayStation({ runner }, { seed: 'Nope' });
    expect(r).toEqual({ playing: false, reason: 'not_found' });
  });

  it('returns ok:false on runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlayStation({ runner }, { seed: 'X' });
    expect((r as any).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/play-station.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/tools/play-station.ts`:

```typescript
import { playStationFromSeed } from '../applescript/play.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlayStationInput { seed: string; }
export type PlayStationOutput =
  | { playing: true; seed: string; starting_track: { artist: string; album: string; track: string } }
  | { playing: false; reason: 'not_found' }
  | ToolError;

export async function handlePlayStation(
  deps: ToolDeps,
  input: PlayStationInput,
): Promise<PlayStationOutput> {
  try {
    const r = await playStationFromSeed(deps.runner, input.seed);
    if (r.ok) return { playing: true, seed: r.seed, starting_track: r.starting_track };
    return { playing: false, reason: r.reason };
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/play-station.test.ts`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/play-station.ts tests/tools/play-station.test.ts
git commit -m "feat(tools): play_station handler"
```

---

### Task 14: `playback_control` ツール (`src/tools/playback-control.ts`)

**Files:**
- Create: `src/tools/playback-control.ts`
- Test: `tests/tools/playback-control.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/tools/playback-control.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handlePlaybackControl } from '../../src/tools/playback-control.js';

describe('handlePlaybackControl', () => {
  it('returns ok:true with state and repeat_mode', async () => {
    const runner = vi.fn().mockResolvedValue('playingone');
    const r = await handlePlaybackControl({ runner }, { action: 'repeat_track' });
    expect(r).toEqual({ ok: true, state: 'playing', repeat_mode: 'one' });
  });

  it('returns ok:false on runner failure', async () => {
    const runner = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await handlePlaybackControl({ runner }, { action: 'next' });
    expect((r as any).ok).toBe(false);
    expect((r as any).error.code).toBe('music_app_unavailable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/playback-control.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/tools/playback-control.ts`:

```typescript
import { sendPlaybackAction, type PlaybackAction } from '../applescript/control.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface PlaybackControlInput { action: PlaybackAction; }
export type PlaybackControlOutput =
  | { ok: true; state: 'playing' | 'paused' | 'stopped'; repeat_mode: 'off' | 'one' | 'all' }
  | ToolError;

export async function handlePlaybackControl(
  deps: ToolDeps,
  input: PlaybackControlInput,
): Promise<PlaybackControlOutput> {
  try {
    return await sendPlaybackAction(deps.runner, input.action);
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/playback-control.test.ts`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/playback-control.ts tests/tools/playback-control.test.ts
git commit -m "feat(tools): playback_control handler"
```

---

### Task 15: `mark_current` ツール (`src/tools/mark-current.ts`)

最もリッチなツール。current_track → 日記追記 → 全日記の reaction 集計 → 昇格判定 → カード upsert。日付・時刻も DI で渡せるようにする（テストのため）。

**Files:**
- Create: `src/tools/mark-current.ts`
- Test: `tests/tools/mark-current.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/tools/mark-current.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleMarkCurrent } from '../../src/tools/mark-current.js';

const cfg = (vault: string) => ({
  vaultPath: vault,
  diarySubdir: 'music/diary',
  albumsSubdir: 'music/albums',
});

const playingRunnerOutput = (artist: string, album: string, track: string) =>
  `playing${artist}${album}${track}10200`;

describe('handleMarkCurrent', () => {
  let vault: string;
  beforeEach(() => { vault = mkdtempSync(join(tmpdir(), 'mdv-')); });
  afterEach(() => { rmSync(vault, { recursive: true, force: true }); });

  it('returns nothing_playing when player is stopped', async () => {
    const runner = vi.fn().mockResolvedValue('stopped');
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T21:35:00') },
    );
    expect(r).toEqual({ marked: false, reason: 'nothing_playing' });
  });

  it('writes diary and promotes when reaction is love', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('Marvin Gaye', "What's Going On", 'Inner City Blues'));
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'love', note: 'やばい' },
      { now: () => new Date('2026-06-12T21:35:00') },
    );
    expect(r.marked).toBe(true);
    expect(r.promoted).toBe(true);
    const diary = readFileSync(join(vault, 'music/diary/2026-06-12.md'), 'utf8');
    expect(diary).toContain('## 21:35 — ♥ Marvin Gaye / Inner City Blues');
    const albumPath = join(vault, "music/albums/Marvin Gaye - What's Going On.md");
    expect(existsSync(albumPath)).toBe(true);
  });

  it('does not promote on a single "like"', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'like' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect(r.marked).toBe(true);
    expect(r.promoted).toBe(false);
    expect(readdirSync(join(vault, 'music/albums'))).toEqual([]);
  });

  it('promotes after two "like"s on same album across two days', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'like' }, { now: () => new Date('2026-06-10T10:00:00') });
    const r = await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'like' }, { now: () => new Date('2026-06-12T10:00:00') });
    expect(r.promoted).toBe(true);
    expect(readdirSync(join(vault, 'music/albums'))).toContain('A - B.md');
  });

  it('preserves first_marked when card already exists', async () => {
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'love' }, { now: () => new Date('2026-06-10T10:00:00') });
    await handleMarkCurrent({ runner }, cfg(vault),
      { reaction: 'meh' }, { now: () => new Date('2026-06-12T10:00:00') });
    const card = readFileSync(join(vault, 'music/albums/A - B.md'), 'utf8');
    expect(card).toMatch(/first_marked: 2026-06-10/);
    expect(card).toMatch(/last_marked: 2026-06-12/);
  });

  it('refuses to write when iCloud placeholder exists for diary file', async () => {
    const { mkdirSync, writeFileSync: w } = await import('node:fs');
    mkdirSync(join(vault, 'music/diary'), { recursive: true });
    w(join(vault, 'music/diary/.2026-06-12.md.icloud'), '');
    const runner = vi.fn().mockResolvedValue(playingRunnerOutput('A', 'B', 'T'));
    const r = await handleMarkCurrent(
      { runner },
      cfg(vault),
      { reaction: 'love' },
      { now: () => new Date('2026-06-12T10:00:00') },
    );
    expect(r).toEqual({
      marked: false,
      reason: 'icloud_placeholder',
      path: expect.stringContaining('2026-06-12.md'),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/mark-current.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`src/tools/mark-current.ts`:

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from '../config.js';
import { getCurrentTrack } from '../applescript/current.js';
import { appendDiaryEntry, parseAlbumReactions, type Reaction } from '../obsidian/diary.js';
import { shouldPromote, upsertAlbumCard } from '../obsidian/album-card.js';
import { hasICloudPlaceholder } from '../obsidian/icloud.js';
import { resolveDiaryPath, resolveAlbumCardPath } from '../obsidian/paths.js';
import type { ToolDeps, ToolError } from './current-track.js';

export interface MarkCurrentInput { reaction: Reaction; note?: string; }
export interface MarkCurrentClock { now: () => Date; }

export type MarkCurrentOutput =
  | { marked: false; reason: 'nothing_playing' }
  | { marked: false; reason: 'icloud_placeholder'; path: string }
  | { marked: true; diary_path: string; album_card_path?: string; promoted: boolean }
  | ToolError;

function pad2(n: number): string { return String(n).padStart(2, '0'); }
function isoDate(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function hhmm(d: Date): string { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

async function readAllDiaries(cfg: Config): Promise<string[]> {
  const dir = join(cfg.vaultPath, cfg.diarySubdir);
  let names: string[] = [];
  try { names = await readdir(dir); } catch { return []; }
  const out: string[] = [];
  for (const n of names) {
    if (!n.endsWith('.md')) continue;
    try { out.push(await readFile(join(dir, n), 'utf8')); } catch { /* skip */ }
  }
  return out;
}

export async function handleMarkCurrent(
  deps: ToolDeps,
  cfg: Config,
  input: MarkCurrentInput,
  clock: MarkCurrentClock,
): Promise<MarkCurrentOutput> {
  let track;
  try {
    track = await getCurrentTrack(deps.runner);
  } catch (e) {
    return { ok: false, error: { code: 'music_app_unavailable', message: (e as Error).message } };
  }
  if (!track.artist || !track.album || !track.track) {
    return { marked: false, reason: 'nothing_playing' };
  }

  const now = clock.now();
  const isoToday = isoDate(now);
  const diaryTarget = resolveDiaryPath(cfg, isoToday);
  if (await hasICloudPlaceholder(diaryTarget)) {
    return { marked: false, reason: 'icloud_placeholder', path: diaryTarget };
  }
  const albumTarget = resolveAlbumCardPath(cfg, track.artist, track.album);
  if (await hasICloudPlaceholder(albumTarget)) {
    return { marked: false, reason: 'icloud_placeholder', path: albumTarget };
  }

  const diary_path = await appendDiaryEntry(cfg, {
    isoDate: isoToday,
    time: hhmm(now),
    artist: track.artist,
    album: track.album,
    track: track.track,
    reaction: input.reaction,
    note: input.note,
  });

  const diaries = await readAllDiaries(cfg);
  const counts = parseAlbumReactions(diaries, track.artist, track.album);

  if (shouldPromote(counts)) {
    const card_path = await upsertAlbumCard(cfg, {
      artist: track.artist,
      album: track.album,
      counts,
      isoDate: isoToday,
      noteLine: input.note,
    });
    return { marked: true, diary_path, album_card_path: card_path, promoted: true };
  }
  return { marked: true, diary_path, promoted: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/mark-current.test.ts`
Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/mark-current.ts tests/tools/mark-current.test.ts
git commit -m "feat(tools): mark_current with diary append and card promotion"
```

---

## Phase 5: 統合

### Task 16: MCP サーバーエントリ (`src/index.ts`)

`@modelcontextprotocol/sdk` の Server を立て、5ツールを登録する。各ツールに JSON Schema を定義。

**Files:**
- Overwrite: `src/index.ts`
- Test: smoke test (next task)

- [ ] **Step 1: Overwrite `src/index.ts`**

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { runAppleScript } from './applescript/runner.js';
import { handleCurrentTrack } from './tools/current-track.js';
import { handlePlayAlbum } from './tools/play-album.js';
import { handlePlayStation } from './tools/play-station.js';
import { handlePlaybackControl } from './tools/playback-control.js';
import { handleMarkCurrent } from './tools/mark-current.js';

const cfg = loadConfig();
const deps = { runner: runAppleScript };
const clock = { now: () => new Date() };

const tools = [
  {
    name: 'current_track',
    description: 'Return the currently playing track info from Music.app.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'play_album',
    description: 'Play an album by artist + album name.',
    inputSchema: {
      type: 'object',
      properties: { artist: { type: 'string' }, album: { type: 'string' } },
      required: ['artist', 'album'],
      additionalProperties: false,
    },
  },
  {
    name: 'play_station',
    description: 'Start an Apple Music station from an artist or genre seed.',
    inputSchema: {
      type: 'object',
      properties: { seed: { type: 'string', description: 'Artist or genre' } },
      required: ['seed'],
      additionalProperties: false,
    },
  },
  {
    name: 'playback_control',
    description: 'Control playback: play / pause / next / previous / repeat_track / repeat_off.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'next', 'previous', 'repeat_track', 'repeat_off'],
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    name: 'mark_current',
    description:
      'Stamp the currently playing track with a reaction (love/like/meh/skip). Appends to the day diary and promotes to an album card on love>=1 or like>=2.',
    inputSchema: {
      type: 'object',
      properties: {
        reaction: { type: 'string', enum: ['love', 'like', 'meh', 'skip'] },
        note: { type: 'string' },
      },
      required: ['reaction'],
      additionalProperties: false,
    },
  },
];

const server = new Server(
  { name: 'music-digger-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  let result: unknown;
  switch (name) {
    case 'current_track':
      result = await handleCurrentTrack(deps);
      break;
    case 'play_album':
      result = await handlePlayAlbum(deps, args as { artist: string; album: string });
      break;
    case 'play_station':
      result = await handlePlayStation(deps, args as { seed: string });
      break;
    case 'playback_control':
      result = await handlePlaybackControl(deps, args as any);
      break;
    case 'mark_current':
      result = await handleMarkCurrent(deps, cfg, args as any, clock);
      break;
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Build to check for type errors**

Run: `npm run build`
Expected: PASS (no TypeScript errors). The `build/index.js` exists.

If errors come from `@modelcontextprotocol/sdk` types, inspect installed version and adjust imports (e.g. `@modelcontextprotocol/sdk/server/index.js` vs. another path).

- [ ] **Step 3: Manual stdio smoke test**

Run from a terminal:

```bash
OBSIDIAN_VAULT_PATH="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecondBrain" \
  node build/index.js < /dev/null
```

Expected: the process starts and waits on stdin. Send Ctrl+C to exit. No crash on startup is the success criterion here.

Then check the listing using a quick MCP probe (send a `tools/list` JSON-RPC message via stdin):

```bash
OBSIDIAN_VAULT_PATH="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecondBrain" \
  node build/index.js <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
JSON
```

Expected: a JSON response listing 5 tools.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all previous tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire MCP server entrypoint with 5 tools"
```

---

### Task 17: Claude Code 設定例とローカル README

最後に、Claude Code から接続する `.mcp.json` のサンプルと、ヒサさんが運用するための手順をプロジェクト直下の README にまとめる。

**Files:**
- Create: `README.md`
- Create: `examples/mcp.json`

- [ ] **Step 1: Create `examples/mcp.json`**

```json
{
  "mcpServers": {
    "music-digger": {
      "command": "node",
      "args": ["/Users/hisasann/_/ai/music-digger-mcp/build/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/Users/hisasann/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecondBrain"
      }
    }
  }
}
```

- [ ] **Step 2: Create `README.md`**

````markdown
# music-digger-mcp

Apple Music を Claude Code から自然言語で扱える MCP サーバー。聴いた曲のうち「反応した曲」だけを Obsidian Vault に蓄積する。

## Tools

- `play_station(seed)` — Music.app のステーションを seed（アーティスト/ジャンル）で起動
- `play_album(artist, album)` — アルバム再生
- `current_track()` — 現在曲取得
- `playback_control(action)` — play / pause / next / previous / repeat_track / repeat_off
- `mark_current(reaction, note?)` — 現在曲を love / like / meh / skip でマーク。日記追記＋昇格判定でアルバムカード生成

## 動作環境

- macOS（AppleScript で Music.app を操作）
- Node.js LTS
- Apple Music サブスクリプション
- Obsidian Vault

## セットアップ

```bash
npm install
npm run build
```

## Claude Code への接続

`examples/mcp.json` を参考に、Claude Code の `.mcp.json` に `music-digger` エントリを追加して再起動する。

## 開発

```bash
npm run dev          # tsx watch でホットリロード
npm test             # vitest
npm test:watch       # vitest watch
```

## 環境変数

| 変数 | デフォルト |
|---|---|
| `OBSIDIAN_VAULT_PATH` | 必須 |
| `MUSIC_DIARY_SUBDIR` | `music/diary` |
| `MUSIC_ALBUMS_SUBDIR` | `music/albums` |

## 仕様書 / 実装計画

- `docs/superpowers/specs/2026-06-12-music-digger-mcp-design.md`
- `docs/superpowers/plans/2026-06-12-music-digger-mcp.md`
````

- [ ] **Step 3: Commit**

```bash
git add README.md examples/mcp.json
git commit -m "docs: README and Claude Code .mcp.json example"
```

---

## 完了基準

- `npm test` で全テストが通る
- `npm run build` がエラーなく完了する
- Claude Code に MCP を登録した後、`tools/list` で5本のツールが返る
- 「ソウル流して」「いまの曲やばい」「次の曲に行って」が Claude Code 経由で動く（手動 E2E）
- 「いまの曲やばい」と言ったときに `music/diary/<YYYY-MM-DD>.md` に追記され、`music/albums/<artist> - <album>.md` が生成される

## 次フェーズ候補（このプランの範囲外）

- 実機 E2E のチェックリスト整備
- ステーション起動の AppleScript の Music.app バージョン差分対応
- カタログ検索ツール (`search_catalog`)
- `play_shuffle` / `play_queue` / `enqueue`
- Apple Music API (MusicKit) 連携
