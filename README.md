# music-digger-mcp

YouTube + Safari + Apple Music で音楽を掘るための MCP サーバー。Claude Code から自然言語で操作し、聴いて反応した曲だけを Obsidian Vault に蓄積する。

> **v0.2.0 で再生エンジンを YouTube に切り替えました。** 旧 Apple Music + AppleScript ベースの理由は `docs/superpowers/specs/2026-06-13-youtube-pivot.md` を参照。

## ワークフロー

1. `play_station("Roy Ayers")` → YouTube 検索 → Safari で再生（autoplay 無し、MCP が制御）
2. 気に入ったら `mark_current("love")` → Obsidian 日記に追記 + iTunes Search API で楽曲を照合 → **Music.app で同じ楽曲ページを開く**（あとはユーザーが「+」でライブラリ追加・再生）
3. love 1 回 or like 2 回でアルバムカードに自動昇格

> Apple Music カタログの「特定の曲」を AppleScript から再生する公式 API は無く、URL を `open` しても navigate するだけで自動再生しない。digger としての再生は **YouTube + Safari** に統一し、Apple Music は「気に入った曲をあとで聴くための着地点」として使い分ける。

## Tools

- `play_station(seed?)` — YouTube 検索で seed の station を Safari で起動。seed 省略時は `music/stations.md` からランダム
- `play_album(artist, album)` — `<artist> <album> full album` で YouTube 検索 → Safari
- `current_track()` — MCP が「最後に再生指示した曲」の情報を返す（ブラウザに問い合わせない）
- `mark_current(reaction, note?, artist?, album?, track?)` — 現在曲を love / like / meh / skip でマーク。日記追記 + 昇格判定。love / like の時は iTunes Search API で Apple Music カタログを引いて、Music.app に楽曲ページを開く

## 動作環境

- macOS（Safari、Music.app、`open` コマンド）
- Node.js 18+ (built-in fetch)
- YouTube アカウント（Safari でログイン推奨。Premium ならバックグラウンド再生・広告無し）
- Apple Music サブスクリプション（love した曲を Music.app で続けるなら）
- Obsidian Vault

## セットアップ

```bash
npm install
npm run build
```

Safari で YouTube にログインしておく（Premium 推奨）。`youtube.com` の autoplay は OFF にしておくと state ずれが起きない。

## Claude Code への接続

`examples/mcp.json` を参考に、Claude Code の `.mcp.json` に `music-digger` エントリを追加して再起動する。

## 開発

```bash
npm run dev          # tsx watch でホットリロード
npm test             # vitest
npm run test:watch   # vitest watch
```

## 環境変数

| 変数 | デフォルト | 用途 |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | 必須 | Obsidian Vault のルート |
| `MUSIC_DIARY_SUBDIR` | `music/diary` | 反応日記の保存先 |
| `MUSIC_ALBUMS_SUBDIR` | `music/albums` | アルバムカードの保存先 |
| `MUSIC_STATIONS_PATH` | `music/stations.md` | station の seed リスト |

## stations.md の書き方

```md
## ソウル / ファンク
- Aaron Frazer       # Introducing... が今のお気に入り (Bad News)
- Curtis Harding     # ◎ The Power
- Roy Ayers          # ◎ Everybody Loves The Sunshine

## スキップ中
# - Lofi             # 今の気分じゃない
```

- 行頭 `- ` で 1 行 1 seed
- 行頭が `#` の行はコメント / 無効化
- 末尾の ` # ...` は seed の覚え書き（パーサーが無視する）

## 仕様書 / 実装計画

- `docs/superpowers/specs/2026-06-12-music-digger-mcp-design.md` — 初版（Apple Music ベース、現在は参考資料）
- `docs/superpowers/specs/2026-06-13-youtube-pivot.md` — YouTube 移行設計メモ
- `docs/superpowers/plans/2026-06-12-music-digger-mcp.md` — 旧実装計画

## 注意

- YouTube の HTML スクレイピングを使用しているため、YouTube 側のレイアウト変更で壊れる可能性があります（個人用前提）
- `current_track` は MCP がこのセッションで再生指示した曲のみを反映します。ブラウザ上で手動で次の曲に進めた場合は state がずれます（その間 `mark_current` を呼ばなければ実害なし）
- `mark_current` の love / like で Music.app の楽曲ページが開きますが、ライブラリへの追加は手動で「+」を押してください
