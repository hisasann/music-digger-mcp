# music-digger-mcp — 設計仕様書

作成日: 2026-06-12
ステータス: ドラフト（ユーザーレビュー待ち）

## 1. 目的

Apple Music を「気に入りそうな音楽」を発見していくためのディグ環境として、Claude Code から自然言語で扱えるようにする MCP サーバーを作る。同時に、**反応があった曲だけ** を Obsidian Vault に蓄積し、自分専用の音楽探索ログ（半年・1年単位の発見アーカイブ）を構築する。

## 2. 背景

- ユーザーは「自分が好きになる音楽を死ぬまで探したい」「知らないジャンルも聴きたい」と考えている
- 実態は **「ダラダラ流す + たまに反応する」** という運用スタイル。全件評価はしない
- 既に Obsidian で日記運用をしており、音楽日記との親和性が高い
- Mac + Apple Music + Claude Code + Obsidian の環境が揃っている

## 3. スコープ（MVP）

### 含むもの

- Apple Music（Music.app）の **ステーション再生**（ダラダラ流し）と **アルバム再生**（ピンポイント）
- 再生制御（次の曲 / 前の曲 / リピート / 一時停止 / 再開）
- 現在再生中の曲情報の取得
- **反応駆動の Obsidian 書き込み**: ユーザーが意思表示したときだけ日記に記録
- 反応の蓄積に応じたアルバムカードの自動昇格

### 含まないもの

- 全件の自動再生ログ（ノイズを増やすため）
- カタログ検索ツール — Claude が知識で補完する
- プレイリスト作成 — 将来拡張
- 自動推薦エンジン — Claude Code 側に判断を委ねる
- Apple Music API（MusicKit）連携 — 将来拡張

### 設計原則

1. **再生 ≠ ログ**: MCP は流すだけ。ヒサさんが意思表示したときだけ書き込む
2. **MCP は道具に徹する**: 「何を流すか」は Claude が決める。MCP は実行に専念
3. **反応で昇格**: アルバムカードは「気に入った」反応が一定回数たまったときだけ生成

## 3.5 用語

- **seed**（シード）: ステーション再生やジャンル探索の **起点になる「種」** のこと。アーティスト名 or ジャンル名を指す文字列を意味する。推薦システムで一般的に使われる用語で、「ここを起点に派生して類似の曲を連続再生する」という比喩から来ている。
  - 例: `play_station("Marvin Gaye")` の `"Marvin Gaye"` が seed
  - 例: `music/seeds.md` には探索の起点となるアーティスト・ジャンルを並べる

## 4. アーキテクチャ

```
Claude Code (LLM 判断)
        │
        ▼
   MCP サーバー (music-digger-mcp)
        │
        ├─► AppleScript (osascript)
        │       │
        │       ▼
        │   Music.app ─► Apple Music カタログ
        │
        └─► File I/O
                │
                ▼
         Obsidian Vault (iCloud 同期)
```

## 5. 技術スタック

- 言語: TypeScript (Node.js LTS)
- MCP SDK: `@modelcontextprotocol/sdk`
- Apple Music 操作: AppleScript（`child_process` で `osascript` を呼び出す）
- Obsidian 連携: ファイルシステム直書き（`fs/promises`）

## 6. プロジェクト構成

```
music-digger-mcp/
├── src/
│   ├── index.ts              # MCP サーバーエントリ
│   ├── tools/                # MCP ツール定義（5本）
│   │   ├── play-station.ts
│   │   ├── play-album.ts
│   │   ├── current-track.ts
│   │   ├── mark-current.ts
│   │   └── playback-control.ts
│   ├── applescript/
│   │   ├── runner.ts         # osascript 実行ヘルパ
│   │   ├── play.ts
│   │   ├── current.ts
│   │   └── control.ts
│   ├── obsidian/
│   │   ├── paths.ts          # パス解決とディレクトリ作成
│   │   ├── diary.ts          # 日記追記
│   │   ├── album-card.ts     # アルバムカード生成と昇格判定
│   │   └── icloud.ts         # iCloud 同期検出
│   └── config.ts             # 環境変数の集約
├── package.json
└── tsconfig.json
```

すべて小文字でディレクトリを構成する。

## 7. MCP ツール仕様（5本）

### 7.1 `play_station`

アーティスト or ジャンルを seed にしてステーション再生を開始する。MVP の本命。

- 引数: `seed: string` — アーティスト名 or ジャンル名（例: `"Marvin Gaye"`, `"Soul"`）
- 動作:
  1. AppleScript で Music.app のカタログ検索を行い、seed にマッチする最初の曲を取得
  2. その曲を再生し、Music.app の「Create Station」コマンドでステーションを起動
  3. 起動後はバックグラウンドで連続再生される
- 戻り値: `{ playing: true, seed: string, starting_track: { artist, album, track } }`
- 失敗時: `{ playing: false, reason: "not_found" | "music_app_unavailable" }`

### 7.2 `play_album`

指定アルバムをピンポイントで再生する。

- 引数: `artist: string`, `album: string`
- 動作: AppleScript で対象アルバムを検索 → 1曲目から再生開始
- 戻り値: `{ playing: true, artist, album, first_track: string }`
- 失敗時: `{ playing: false, reason: "not_found" | "music_app_unavailable" }`

### 7.3 `current_track`

現在再生中の曲情報を取得する（読み取り専用）。

- 引数: なし
- 戻り値: `{ playing: boolean; artist?; album?; track?; position?; duration? }`

### 7.4 `mark_current`

現在再生中の曲に反応スタンプを押す。**唯一の Obsidian 書き込みツール**。

- 引数:
  - `reaction: "love" | "like" | "meh" | "skip"`
  - `note?: string` — 自由メモ
- 動作:
  1. `current_track` を内部で呼んで現在曲を取得
  2. 当日の日記ファイル `music/diary/YYYY-MM-DD.md` に時刻付きでエントリを追記
  3. アルバムカード昇格判定（後述）を行う
- 戻り値: `{ marked: true, diary_path, album_card_path?: string, promoted: boolean }`
- 現在再生中の曲がない場合: `{ marked: false, reason: "nothing_playing" }`

### アルバムカード昇格ルール

`mark_current` が呼ばれるたびに、同一アルバムに対する過去の反応を日記から集計し、以下の条件のいずれかを満たしたらアルバムカードを生成 / 更新する:

- 同一アルバム内で **`love` が1回でも出た**
- 同一アルバム内で **`like` が累計2回以上出た**

`meh` / `skip` のみではカード化しない。一度生成されたカードは、後の `meh` / `skip` 評価では削除しない（過去の発見を保護）。

### 7.5 `playback_control`

再生制御。

- 引数: `action: "play" | "pause" | "next" | "previous" | "repeat_track" | "repeat_off"`
- 動作: 各アクションを対応する AppleScript コマンドに変換して Music.app に送る
  - `play`: 一時停止中なら再生再開、再生中なら何もしない
  - `pause`: 一時停止
  - `next`: 次の曲へスキップ
  - `previous`: 前の曲に戻る（再生開始から短時間は曲頭に戻す挙動の場合あり、Music.app の標準仕様に従う）
  - `repeat_track`: 現在再生中の曲を1曲リピート
  - `repeat_off`: リピートを解除
- 戻り値: `{ ok: true, state: "playing" | "paused" | "stopped", repeat_mode?: "off" | "one" | "all" }`
- 失敗時: `{ ok: false, error: { code, message } }`

### 使われ方の例（自然言語 → ツール呼び出し）

| ヒサさんの発話 | Claude が呼ぶツール |
|---|---|
| 「ソウルダラダラ流して」 | `play_station("Soul")` |
| 「What's Going On 流して」 | `play_album("Marvin Gaye", "What's Going On")` |
| 「いまの曲なに？」 | `current_track()` |
| 「いまの曲やばい」 | `mark_current("love", "...")` |
| 「この曲をリピートして」 | `playback_control("repeat_track")` |
| 「次の曲に行って」 | `playback_control("next")` |
| 「一曲戻って」 | `playback_control("previous")` |
| 「ちょっと止めて」 | `playback_control("pause")` |

## 8. Obsidian Vault レイアウト

### Vault パス

```
/Users/hisasann/Library/Mobile Documents/iCloud~md~obsidian/Documents/SecondBrain
```

### サブディレクトリ

```
<vault>/music/diary/         # 1日1ファイル（YYYY-MM-DD.md）
<vault>/music/albums/        # 1アルバム1ファイル（昇格条件を満たしたものだけ）
```

### 日記ファイルの形式

`music/diary/2026-06-12.md`:

```markdown
# 2026-06-12

## 21:35 — ♥ Marvin Gaye / Inner City Blues (What's Going On)
love
- "イントロのドラムだけで持ってかれる"

## 22:10 — ★ Fela Kuti / Water No Get Enemy (Expensive Shit)
like

## 22:40 — Fela Kuti / Water No Get Enemy (Expensive Shit)
meh
- "やっぱり長い"
```

- 反応があった曲だけが時系列で並ぶ
- ダラダラ流れた他の曲は記録されない（軽量）
- 反応の絵文字: `love` → `♥`、`like` → `★`、`meh` → 無印、`skip` → `×`

### アルバムカードの形式

`music/albums/Marvin Gaye - What's Going On.md`:

```yaml
---
artist: Marvin Gaye
album: What's Going On
reactions:
  love: 1
  like: 0
  meh: 0
  skip: 0
first_marked: 2026-06-12
last_marked: 2026-06-12
---

- 2026-06-12: love — "イントロのドラムだけで持ってかれる"
```

- ファイル名は `<artist> - <album>.md`
- ファイル名サニタイズ: `/`, `:`, `\` を `_` に置換、前後の空白を除去、先頭が `.` の場合は `_` を前置
- 既存カードがある場合: `reactions` カウントを再集計、`last_marked` を更新、本文に新しいメモを追記、`first_marked` は保護

## 9. seeds の扱い

MVP では **seeds ファイルを MCP ツールとして公開しない**。

- Claude Code は通常の Read / Edit ツールで `music/seeds.md` を直接読み書きできるため、MCP 化する必要がない
- ヒサさんは Obsidian から `music/seeds.md` を直接編集できる
- Claude が「次に何を流すか」を判断するとき、必要なら Read で seeds を参照する

`music/seeds.md` の推奨形式（任意・人間が編集する想定）:

```markdown
---
genres_known_liked: [Soul, Jazz Funk, Trip Hop]
artists_known_liked: [Marvin Gaye, Gil Scott-Heron, Massive Attack]
genres_to_explore: [Afrobeat, Brazilian Music, Dub]
mood_preferences: [夜, グルーヴ, 色気]
---

# メモ
- サイケはあまり刺さらない
- 派手さより色気
```

## 10. 環境変数

| 変数名 | デフォルト | 用途 |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | （必須） | Vault のルート |
| `MUSIC_DIARY_SUBDIR` | `music/diary` | 日記ディレクトリ |
| `MUSIC_ALBUMS_SUBDIR` | `music/albums` | アルバムカードディレクトリ |

## 10.5 起動方法

### 動作モデル

MCP サーバーは **常駐デーモンではなく、Claude Code が自動で起動・終了させる子プロセス** として動作する。

- Claude Code が起動するときに `.mcp.json` の `command` を読み、子プロセスとして起動する
- 通信は stdio（標準入出力）経由の JSON-RPC
- Claude Code を終了するとサーバープロセスも終了する
- ユーザーが別ターミナルで手動起動する必要はない

### 配布方針

個人用途のため npm 公開はしない。ローカルでビルドした成果物を Claude Code から直接起動する。

### ビルド構成

- `tsconfig.json` で `outDir: build` を設定
- エントリポイント: `build/index.js`
- `package.json` の `scripts`:
  - `build`: `tsc`
  - `dev`: `tsx watch src/index.ts`
  - `start`: `node build/index.js`

### Claude Code 側の `.mcp.json` 例

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

### 運用フロー

1. `npm install` で依存を導入
2. `npm run build` で `build/index.js` を生成
3. Claude Code を再起動（または MCP 設定を reload）
4. ツール変更時は `npm run build` → Claude Code 再起動

## 11. エラー処理方針

- **AppleScript 失敗**（Music.app が起動していない等）→ MCP ツールが構造化エラーで返す: `{ ok: false, error: { code: "music_app_unavailable", message: "..." } }`。MCP サーバーは落とさない
- **`mark_current` で何も再生されていない** → `{ marked: false, reason: "nothing_playing" }` を返す（Vault には書かない）
- **Obsidian Vault パスが存在しない** → サーバー起動時にチェックして即エラー終了
- **iCloud 同期中の placeholder ファイル**（`.icloud` 拡張子付き）を検出した場合 → 警告を返す。書き込みはせず、ユーザーに「Obsidian で対象ファイルを開いてダウンロードしてから再実行」を促す
- **AppleScript の出力が想定外** → パースエラーで返す。MCP サーバーは継続

## 12. iCloud 同期に関する注意

Obsidian Vault が iCloud 上にあるため、以下の点に配慮する:

- 書き込み前に親ディレクトリの存在確認と `mkdir -p` を行う
- 書き込み後の即時読み戻しは行わない（同期遅延の影響を避ける）
- ファイル名のサニタイズは Section 8 のルールに従う
- 日記ファイルの追記は「読み込み → 末尾追記 → 書き戻し」のシーケンスで行う

## 13. テスト戦略

- **ユニットテスト**: `obsidian/*` は副作用が小さいので、一時ディレクトリを使った fs テストで網羅。特に **昇格判定ロジック**（`love` 1回 / `like` 2回以上）はテーブル駆動で網羅
- **AppleScript ラッパのテスト**: `applescript/runner.ts` を差し替え可能にして、`osascript` 呼び出しをモック化
- **手動 E2E**: 実機の Music.app を使った再生テストはチェックリスト化して手動実施
- **MCP プロトコル疎通テスト**: `index.ts` をローカル起動して、各ツールを Claude Code 経由で呼ぶスモークテスト

## 14. 将来拡張

- `play_shuffle` / `play_queue` / `enqueue` — より複雑な再生パターン
- `search_catalog` — Apple Music カタログ検索の MCP 化
- MusicKit / Apple Music API 連携
- 日記とアルバムカードを LLM に読ませて「次の1枚」を提案する `dig_next` ツール
- seeds の自動更新ツール

## 15. 成功基準

- Claude Code で「ソウルダラダラ流して」と言ったら、MCP が `play_station("Soul")` を呼んで Music.app でソウルステーションが流れ始める
- ヒサさんが「いまの曲いい」と言ったら、Claude が `mark_current("love")` を呼んで日記とアルバムカードが更新される
- ヒサさんが何も言わずに聴き流した曲は Vault に何も残らない（ノイズゼロ）
- 半年後に `music/albums/` を眺めたときに、「気に入った」と意思表示したアルバムだけが残っており、自分の音楽趣味の地図になっている
