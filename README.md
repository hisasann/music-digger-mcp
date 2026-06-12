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
