# music-digger-mcp — YouTube ピボット設計メモ

作成日: 2026-06-13
ステータス: ドラフト（実装着手前 / ユーザー方針確定済み）
親仕様: `2026-06-12-music-digger-mcp-design.md`

## 1. 経緯

`2026-06-12-music-digger-mcp-design.md` の設計では Apple Music + Music.app + AppleScript を採用したが、実装と運用を進めた結果、以下の致命的な制約が判明した。

### 1.1 Apple Music + AppleScript の構造的限界

| 課題 | 詳細 |
|---|---|
| station 起動 API が無い | Music.app の AppleScript dictionary に `song station` 系プロパティ / `start station from` 系コマンドは存在しない。`set song station of front window to true` は実在しないプロパティを叩いており、コンパイル時に常に失敗していた（`run script` + `try` で握り潰されて表面化しなかっただけ） |
| ライブラリ縛り | `every track whose artist contains "..."` はユーザーのライブラリ内検索しかしない。Apple Music カタログ全体には届かない。digger（未知の音源を掘る）目的と矛盾 |
| カタログから station 起動するには | `open location` で `https://music.apple.com/.../station/.../ra.<id>` を投げる経路があるが、`ra.<id>` 形式の station URL は MusicKit API（要 OAuth）か Web 検索で取得しないと得られず、Claude の知識だけでは出せない |

### 1.2 結論

> Apple Music ベースで digger を実現するには MusicKit OAuth 連携が必須。**スコープが MVP を遥かに超える。**

## 2. 方針転換

Apple Music を捨て、**YouTube + Safari** ベースに作り直す。

### 2.1 確定事項（2026-06-13 ユーザー判断）

| 項目 | 決定 |
|---|---|
| 音源ソース | YouTube（本家 `youtube.com`） |
| 再生先 | Safari（macOS native、chrome-mcp との衝突回避、Music.app と同じ「open で投げる」体験） |
| YouTube Premium | 加入済み（バックグラウンド再生、Mix 制限解除、品質向上の恩恵あり） |
| 検索手段 | **scrape ベース**（YouTube Data API キー / Google Cloud Console は使わない）。`https://www.youtube.com/results?search_query=...` の HTML から `ytInitialData` JSON を抜いて videoId を取得 |
| 連続再生 | **YouTube の autoplay / Mix は使わない。MCP が next を含めて全制御** |
| 「次の曲」の判断 | **Claude が決める**（設計仕様書原則 #2「何を流すかは Claude が決める」と一致）。MCP は実行に専念 |
| 現在曲メタデータ | **再生指示時に MCP が知っている情報を内部 state に保持**。ブラウザに問い合わせない |

### 2.2 設計上の核心

「ブラウザから真の現在状態を取りに行く」アプローチを完全に放棄する。代わりに：

```
play 指示時点で MCP が知っている videoId / title / channel を、
MCP プロセス内 state に「これが今鳴ってる」として記録する。
mark_current / current_track はこの state を返すだけ。
```

これにより：

- **autoplay を無効化する前提なので state は常に正しい**（ブラウザ側で勝手に進まない）
- ブラウザ自動化 / Chrome MCP / DOM スクレイピング不要
- 設計仕様書原則「MCP は道具に徹する」を維持
- `mark_current` の Obsidian 連動ロジック（`appendDiaryEntry` / album promote）はそのまま流用可能

## 3. 新アーキテクチャ

```
Claude Code (LLM 判断)
        │
        │  「Roy Ayers の Everybody Loves The Sunshine を流して」
        │  「次は同じアーティストの別の曲」
        ▼
   MCP サーバー (music-digger-mcp)
        │
        ├─► YouTube scrape
        │       │  https://www.youtube.com/results?search_query=...
        │       │  HTML → ytInitialData → videoId / title / channel
        │       ▼
        │   候補リスト
        │
        ├─► 内部 state 更新
        │       { videoId, title, channel, startedAt, sourceSeed }
        │
        ├─► open -a Safari "https://www.youtube.com/watch?v=<id>"
        │       │
        │       ▼
        │   Safari ─► YouTube（Premium、autoplay は手動 OFF 推奨）
        │
        └─► File I/O（既存通り）
                ▼
         Obsidian Vault
```

## 4. ツール仕様

### 4.1 既存ツール（変更）

#### `play_station(seed?)`

- seed の意味は変えない（artist / genre / 任意の検索語句）
- 内部の実装が AppleScript → YouTube scrape + Safari open に変わる
- 戻り値の `starting_track` は scrape で取れた title / channel（YouTube タイトルなのでパース精度は粗い、それは許容）
- 既存の Obsidian stations ノート（`music/stations.md`）からのランダム選択ロジックは流用

```ts
type PlayStationOutput =
  | { playing: true; seed: string;
      now_playing: { videoId: string; title: string; channel: string; url: string } }
  | { playing: false; reason: 'no_seeds' | 'search_empty' | 'scrape_failed' }
  | ToolError;
```

#### `current_track()`

- AppleScript で Music.app に問い合わせる代わりに、**MCP 内部 state を返す**
- 何も再生していなければ `{ playing: false }`

#### `playback_control(action)`

- `next` / `previous`：MCP が新たな検索 / 関連動画を選んで Safari で新しい URL を `open`
  - ただし「次に何を流すか」を MCP 内で決めるのは設計仕様書原則 #2 に反する
  - **暫定**：`playback_control(next)` は「現在 seed の検索結果リストの次の候補」を選ぶ（state に検索結果リストとカーソルを保持）
  - **理想**：next 判断も Claude 経由（next ツールは廃止、Claude が `play_station(next_seed)` を呼ぶ）
- `pause` / `play`：Safari の AppleScript で `keystroke "space"` 経由か、`tell application "Safari" to do JavaScript ...` で video element を操作。**実装難度が上がる**ので MVP では未対応も検討
- `repeat_track` / `repeat_off`：同上、video element 操作。MVP では未対応

#### `mark_current(reaction, note?)`

- ロジックは変わらない。state.current を読んで `appendDiaryEntry` に渡す
- artist / album の認識：YouTube タイトルが `Roy Ayers - Everybody Loves The Sunshine` のような形式なら ` - ` 分割で artist / track を切り出せる。`(Official Audio)` 等のサフィックスはストリップ
- album 情報は YouTube からは取りにくい。channel 名で代用するか、`mark_current` の引数で `artist` / `album` を上書き可能にする（フォールバック）

#### `play_album(artist, album)`

- 「正確なアルバム再生」は YouTube だと曖昧（公式チャンネルのプレイリスト or 1動画にまとめ）
- 暫定：`artist + " " + album + " full album"` で検索して上位を選ぶ
- 精度は妥協する

### 4.2 新規ツール（候補、MVP では入れなくても良い）

| ツール | 目的 |
|---|---|
| `search_tracks(query)` | scrape の結果をそのまま返す。Claude が next を判断する材料にする |
| `play_video(videoId)` | Claude が videoId を直接指定して開く（station ノートに ID も書ける運用） |

## 5. Obsidian 連動

### 5.1 既存資産の流用

- `appendDiaryEntry` / `parseAlbumReactions` / `shouldPromote` / `upsertAlbumCard` は **そのまま動く**
- `mark_current` から state.current（YouTube 由来 metadata）を渡すだけ

### 5.2 stations ノート（`music/stations.md`）の運用変更

- 既存の artist 名ベース箇条書きはそのまま使える
- YouTube 検索の seed として渡される（Claude が「Roy Ayers の good vibe な曲」を検索クエリに拡張するのも自由）

### 5.3 検討事項

- 日記の `(album)` 部分が YouTube タイトル由来になると Apple Music 時代と整合性が落ちる可能性
  - 案：`mark_current(reaction, note?, artist?, album?)` でユーザー上書き可能にする
  - 案：channel 名を album 相当として記録する（Roy Ayers Topic → 公式音源 = album 情報源）

## 6. 実装計画（MVP）

### Phase 1: scrape + Safari open のプロトタイプ（1 セッション）

1. `src/youtube/search.ts`：fetch + `ytInitialData` 抽出関数
2. `src/youtube/open.ts`：`open -a Safari "https://www.youtube.com/watch?v=<id>"`
3. プロトタイプスクリプトで「Roy Ayers」検索 → 1動画 Safari 再生まで確認

### Phase 2: MCP ツール置換（1〜2 セッション）

1. `src/tools/play-station.ts` を書き換え（YouTube 経路）
2. プロセス内 state ストアを実装（シンプルな module-level Map or class）
3. `src/tools/current-track.ts` を state ベースに
4. `src/tools/mark-current.ts` を state ベースに
5. 既存 AppleScript 系コードは `src/applescript/` 配下に残すが index.ts からは外す（将来また使うかもしれないので消さない）

### Phase 3: 制御 / 検索の Claude 駆動化（MVP+）

1. `search_tracks` ツール追加
2. `playback_control(next/previous)` の Claude 駆動化を検討
3. `pause/play` の Safari 操作対応（やるかどうか含めて要検討）

## 7. 未解決事項 / リスク

| 項目 | 内容 | 暫定方針 |
|---|---|---|
| scrape の壊れやすさ | `ytInitialData` の構造変更で動かなくなる可能性 | 壊れたら直す。個人用なので頻度低 |
| YouTube タイトルの metadata 精度 | `(Official Audio)` `feat. ...` `Lyrics` 等のノイズ | ストリップロジックを段階的に育てる。`mark_current` で上書き可能に |
| autoplay 無効化の確実性 | ユーザー側で Safari の YouTube autoplay 設定を OFF にする必要 | README に明記。技術的に強制はしない |
| Premium ログインの維持 | Safari に YouTube Premium でログイン済みが前提 | 初回手動ログイン、以降は cookie 維持 |
| utiliterm 違反リスク | scrape は YouTube の TOS 上グレーゾーン | 個人利用、低頻度、認証回避なし、商用無し。実用上 OK と判断 |
| 既存 Apple Music 実装の扱い | AppleScript 系 / `play_album` / `playback_control` | 別ディレクトリに退避 or 残置。`index.ts` の wiring を切り替える |
| 既存ユニットテスト | 67 + 14 = 81 テストの多くが AppleScript モック前提 | YouTube 系の新規テストを書く。既存は scope 縮小される機能の分は残し、撤退する分は削除 |

## 8. 次のセッションの最初のステップ

1. このメモを再読
2. `src/youtube/search.ts` の scrape プロトタイプを単体スクリプトで動かす（MCP 統合の前）
3. `ytInitialData` から videoId を取り出すパターンを 2-3 クエリで確認（例：`Roy Ayers`, `Hip-Hop mix`, `Aaron Frazer Bad News`）
4. 動いたら `src/tools/play-station.ts` の置換に進む

## 9. 設計仕様書本体への反映

`2026-06-12-music-digger-mcp-design.md` 本体には今は手を入れない。実装が固まったらこちらのメモを取り込んで本体を v2 として書き直す。

## 10. 実装ステータス（2026-06-13 同日着手分）

Phase 1 / 2 / 3 を一気に着地。

### 10.1 Phase 1 — scrape + Safari open プロトタイプ

- `src/youtube/search.ts`: `searchYouTube` / `extractYtInitialData` / `pickVideos` / `preferTopicChannel` を実装
- `src/youtube/open.ts`: `open -a Safari "https://www.youtube.com/watch?v=<id>"` 経由の起動
- 実機検証：Roy Ayers / Isaac Hayes / Aaron Frazer で 5〜8 件取得、`<Artist> - Topic` チャンネルが取れるケースとフルアルバム upload しか取れないケースを確認

### 10.2 Phase 2 — MCP 統合

- `src/state.ts`: プロセス内 in-memory な `PlaybackStore`（`get` / `set` / `clear`）
- `src/youtube/metadata.ts`: `stripTitleNoise`（`(Official Audio)` / 年号 / `Full Album` 等を除去）と `parseTrackTitle`（`Artist - Track` 分割と `- Topic` チャンネルからの album 抽出）
- `src/tools/play-station.ts`: YouTube 検索 → `preferTopicChannel` → Safari open → `store.set` の経路に書き換え
- `src/tools/play-album.ts`: `<artist> <album> full album` で検索する形に書き換え
- `src/tools/current-track.ts`: store ベースに置換（AppleScript 問い合わせを廃止）
- `src/tools/mark-current.ts`: store の current から `parseTrackTitle` → 既存の `appendDiaryEntry` / `upsertAlbumCard` に流す。`artist` / `album` / `track` の手動上書き入力も受ける
- `src/tools/playback-control.ts`: MCP ツール一覧から外す（コードは将来の利用に備えて残置）
- `src/index.ts`: 4 ツール構成（current_track / play_album / play_station / mark_current）に整理、version を 0.2.0 に

### 10.3 Phase 3 — love / like で Apple Music へハンドオフ

ユーザー要望（「気に入った曲は Music.app の楽曲ページを開いてくれるだけでいい」）に応じて追加。

- `src/itunes/search.ts`: 公式 iTunes Search API（無認証）を fetch。`<artist> <track>` で検索、`country=jp` で 5 件取得、先頭を返す
- `src/itunes/open.ts`: `open <trackViewUrl>` で macOS デフォルトハンドラ（= Music.app）に投げる
- `src/tools/mark-current.ts`: love / like のときだけ iTunes 検索 → Music.app open。レスポンスに `apple_music` フィールド（`{ opened: true, url, matched_artist, matched_track }` または `{ opened: false, reason }`）を追加。検索失敗 / no_match / open 失敗はすべて非致命扱いで diary 書き込みは継続

### 10.4 テスト

- 既存 81 → 新規追加で **計 116 件**（19 → 21 ファイル）。すべて green
- YouTube / iTunes / state / metadata / 全ツールの新形式に対応
- 実 HTTP / 実 osascript / 実 open は触らない（fetcher と runner を注入してモック）

### 10.5 README

`README.md` を v0.2.0 ワークフロー（YouTube + Safari + Apple Music handoff）に書き直し済み。stations.md の書式と `MUSIC_STATIONS_PATH` env も反映。

### 10.6 残りの宿題

- 実機での MCP 再起動 → エンドツーエンド動作確認（Safari で再生 / Music.app に love 曲が出るか）
- YouTube タイトルのパース精度（ハイフン違い、feat. 表記、Lyrics ビデオ等）を実運用で詰める
- `playback_control` の Safari / Music.app での復活（必要になったら）
- 親仕様書 `2026-06-12-music-digger-mcp-design.md` を v2 として書き直し

## 11. 再ピボット試行と撤回：再生は YouTube + Safari に戻す（2026-06-13 同日後半）

### 11.0 結論先出し

「YouTube で見つけて Apple Music で再生」を試みたが、**Apple Music カタログの特定トラックを AppleScript から自動再生する手段が無い**ことが実機検証で判明したため、再生は再び **YouTube + Safari** に統一。Apple Music へのハンドオフは `mark_current(love|like)` 時のみに戻した。

### 検証で出尽くした選択肢（全部「特定曲再生」には届かなかった）

| 方法 | navigate | 自動再生 | `?i=trackId` 解釈 |
|---|---|---|---|
| `open <https URL>` | ブラウザに行く | — | — |
| `open -a Music <URL>` | ✓ | ✗ | — |
| `open music://...` | ✓ | ✗ | — |
| `tell Music to open location URL` | ✓ | ✗ | **✗** |
| 上記 + `delay` + `play` | ✓ | ✓ | **✗ → アルバム 1 曲目** |

`play` の direct-parameter は Music.app 内 specifier（=library 内 track）限定で、カタログ trackId を直接渡せない。`?i=trackId` パラメータはアルバム navigate の URL から無視される。結果、何をやっても「アルバム 1 曲目から再生」になり、検索でヒットした曲とは別物が鳴ってしまう。

実害として `play_station("Marvin Gaye")` が Gil Scott-Heron や Billie Eilish を再生する事故が出た（前者は前回 paused 状態の race、後者は YouTube タイトル誤解析と相まって発生）。

### 取り直した形

- `play_station` / `play_album` は **YouTube + Safari** で再生。`playedIn` は常に `'youtube'`
- `mark_current(love|like)` のとき iTunes Search で楽曲を引いて **Music.app に navigate するだけ**（自動再生は要求しない）
- `src/itunes/match.ts` の `lookupAppleMusic` は使い所がなくなったので削除
- `src/itunes/open.ts` を `open -a Music <url>` に戻し、AppleScript 経由の `open location` + `play` 連鎖は廃止
- README / spec memo を「YouTube で再生、Apple Music は love 時のハンドオフ専用」に揃え直し
- テスト 117 件 green

### 旧 §11 で書いた設計（YouTube 検索エンジン化 + Apple Music 再生）は撤回。下の記録は当時の意図として残す。

## 11.5 撤回した設計の記録（旧 §11）

### 11.1 きっかけ

実機検証で 2 点判明：

1. `open https://music.apple.com/...` だと macOS のデフォルトハンドラ（ブラウザ）に行ってしまい、Music.app は開かない。`open -a Music <url>` が必要
2. ユーザー本来の意図は「YouTube を**カタログ検索エンジン**として使い、再生は **Apple Music** で行いたい」だった。YouTube を画面上で開くのは結果に過ぎない

### 11.2 新フロー

```
play_station(seed)
  ↓ YouTube scrape（裏で、Safari は開かない）
  ↓ 上位ヒットの title から artist + track 切り出し（parseTrackTitle）
  ↓ iTunes Search API で Apple Music カタログ照合（lookupAppleMusic）
  ├─ ヒット → openAppleMusicUrl で `open -a Music <trackViewUrl>` → Music.app 再生
  │           store.playedIn = 'apple_music'
  └─ 外れ   → openInSafari で YouTube fallback（カバー・ライブ等は YouTube にしか無い）
              store.playedIn = 'youtube'
```

### 11.3 重複排除

「Apple Music に持ち込む」責務は **`play_station` / `play_album` が一手に持つ**。`mark_current` は：

- `state.playedIn === 'apple_music'` のとき → 既に Apple Music で再生中なので open は **冗長スキップ**（`apple_music: { opened: false, reason: 'already_in_apple_music' }`）
- `state.playedIn === 'youtube'` のとき → 従来通り iTunes 検索 + Music.app open（YouTube fallback で見つけた曲を love したら Apple Music に拾い直す）

これで「同じ機能が 2 箇所」状態を解消。

### 11.4 副作用

- **Safari タブの累積問題が消える**：通常パスでは Safari を起動しない。fallback でのみタブが増える
- **レスポンス改善余地**：Safari 起動コストが消える。残るボトルネックは YouTube HTML scrape（1.2MB、約 0.6s）。`m.youtube.com` への切り替えで 半分（530KB）まで落とせることを実測済み（別タスク）
- `state` に `playedIn` / `appleMusicUrl` / `appleMusicArtist` / `appleMusicTrack` を追加

### 11.5 ファイル変更

- 新規 `src/itunes/match.ts`：`lookupAppleMusic(title, channel, deps)` 共通ヘルパー
- `src/itunes/open.ts`：`open -a Music` 強制
- `src/state.ts`：`playedIn` 等の追加
- `src/tools/play-station.ts` / `play-album.ts`：iTunes 照合 → Apple Music or Safari fallback の二分岐
- `src/tools/mark-current.ts`：`playedIn` 分岐で重複 open を排除
- テスト：fetcher mock を YouTube / iTunes で URL 分岐し、両ルートを網羅。**119 件 green**
