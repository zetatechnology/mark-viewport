# Mark Viewport

Markdown ファイル（`.md` / `.markdown`）をブラウザ上で GitHub 風に整形表示する Chrome 拡張機能（Manifest V3）です。

## 機能

- ローカルファイル（`file:///…/README.md`）と Web 上の生テキストの .md（例: `raw.githubusercontent.com`）を自動で整形表示
- GFM：表、タスクリスト、打ち消し線、自動リンク、脚注
- コードのシンタックスハイライト（highlight.js の主要言語）とコピーボタン
- Mermaid の図（` ```mermaid `）。テーマに合わせてライト / ダークで描画
- 数式（KaTeX）：`$…$`、`$$…$$`、` ```math `
- GitHub のアラート（`> [!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`）
- 絵文字ショートコード（`:tada:` など。`:)` のような顔文字は変換しない）
- 目次サイドバー（現在位置をハイライト）、見出しへのアンカーリンク
- ダークモード（OS に連動 / 手動）、本文幅・文字サイズの設定
- 「ソース」ボタンまたはツールバーアイコンで元のテキストに切替
- ローカルファイルの自動リロード（保存すると反映）
- 編集モード（「編集」ボタン / `Ctrl+E`）：テキストを全画面で編集し、「プレビュー」ボタン（`Ctrl+Shift+P`）で整形結果を前面に表示（`Esc` で戻る）。`Ctrl+S` でファイルに上書き保存（下記参照）
- YAML フロントマターは折りたたんで表示
- HTML は DOMPurify でサニタイズ（`<script>` やイベント属性は除去）
- 日本語 / 英語 UI

## 開発

```powershell
npm install
npm run build      # dist/ に出力
npm run watch      # 変更を監視してビルド
npm run typecheck
npm run serve      # http://127.0.0.1:5178/sample.md で test/sample.md を text/plain として配信
```

拡張機能を読み込まずに表示を確認するには、`npm run build` の後 `npm run serve` で http://127.0.0.1:5178/preview.html?file=sample.md&theme=dark を開きます（`chrome` API をスタブして content script を実行するテスト用ページ）。コンソールで `mvSetTheme('light')` を呼ぶとテーマ変更も試せます。

### Chrome に読み込む

1. `npm run build`
2. `chrome://extensions` を開き、右上の「デベロッパー モード」をON
3. 「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択
4. ローカルファイルを表示する場合は、拡張機能の「詳細」で **「ファイルの URL へのアクセスを許可する」** をON

### 構成

| パス | 内容 |
| --- | --- |
| `src/content/index.ts` | .md ページを検出し、ページを描画内容に置き換える（目次・切替・自動リロード） |
| `src/content/render.ts` | markdown-it + プラグイン + highlight.js + DOMPurify |
| `src/content/plugins.ts` | 数式・Mermaid・GitHub アラートの markdown-it プラグイン |
| `src/content/save.ts` | 編集内容の保存（File System Access API、保存先ハンドルを IndexedDB に記憶） |
| `src/content/enhance.ts` | 描画後の処理：コピーボタン、KaTeX / Mermaid の遅延読み込みと描画 |
| `src/lazy/` | KaTeX と Mermaid。`dist/lazy/` に ES モジュールとして別ビルドし、該当するブロックがあるページでだけ読み込む |
| `src/background.ts` | ツールバーボタン、ローカルファイルの再読み込み（`fetch`） |
| `src/options.ts` / `public/options.html` | 設定画面（`chrome.storage.sync`） |
| `public/content.css` | 表示スタイル。すべて `html.mv-active` 配下に限定しており、描画しないページには影響しない |
| `public/manifest.json`, `public/_locales/` | マニフェストと翻訳 |
| `scripts/build.mjs` | Vite で各エントリを IIFE としてビルド |
| `scripts/make-icons.mjs` | アイコン PNG の生成 |

## 動作の仕組み

- content script は URL のパスが `.md` / `.markdown` のページに注入されますが、実際に描画するのは `document.contentType` が `text/plain` / `text/markdown` のときだけです。GitHub の blob ページのような HTML ページには何もしません。
- 自動リロードはローカルファイルのみが対象です。タブが表示されている間、1 秒ごとにバックグラウンドがファイルを読み直し、内容が変わったときだけ再描画します。

## 制限事項

- `raw.githubusercontent.com` はレスポンスの CSP で画像の読み込みを禁止しているため、相対パスの画像は表示されません。
- Mermaid と KaTeX は `dist/lazy/` を `web_accessible_resources` として公開し、content script から動的 `import()` で読み込みます。読み込めないページでは、図や数式はソースのまま表示されます。

## Chrome Web Store 公開

提出に必要な素材・文面・手順は [store/](store/) にまとめています。まず [store/SUBMISSION.md](store/SUBMISSION.md) を見てください。

```powershell
npm run store-assets   # スクリーンショットとプロモーション タイルを store/assets/ に生成
npm run zip            # 提出用の mark-viewport.zip を生成
```

### 権限まわりのメモ

- 権限は `storage`、`file:///*`（自動リロード用）、content script の `.md` / `.markdown` URL のみです。審査フォームに書く権限の理由:
  - **storage**：表示設定の保存
  - **ホスト権限（file:///\*）**：ローカルの Markdown ファイルを読み直して、変更を反映するため
  - **content script（\*.md, \*.markdown）**：Markdown ファイルを整形表示するため
- リモートコードは使用していません（すべてのライブラリを同梱しています）。データの収集もありません。プライバシー欄では「データを収集しない」を選べます。
- 「ファイルの URL へのアクセスを許可する」はインストール後にユーザー自身が ON にする必要があります。ストアの説明文にも書いておきましょう。

## ライセンス

[MIT](LICENSE) © zetatechnology。同梱しているサードパーティのライブラリのライセンスは、ビルド時に生成される `dist/THIRD_PARTY_NOTICES.txt` を参照してください。

## 編集と保存

- 拡張機能から `file://` のファイルへ直接書き込むことはできないため、保存には File System Access API を使います。
- **初回の保存**ではファイル選択ダイアログが開くので（ファイル名は入力済み）、表示中の元ファイルを選んで上書きします。選んだファイルはページの URL ごとに IndexedDB に記憶され、以降の `Ctrl+S` はそのファイルにそのまま保存されます（Chrome が書き込み許可を確認することがあります）。
- `Shift+Ctrl+S` または Shift を押しながら「保存」で保存先を選び直せます。
- 改行コード（CRLF / LF）は元のファイルに合わせて保存します。
- 編集中に外部でファイルが変更された場合、未保存の変更がなければエディタに反映し、あれば警告を表示します（保存すると上書き）。
- 未保存の変更があるまま編集を終了したりタブを閉じたりすると確認が表示されます。
- Web 上の .md でも編集・プレビューはできます。保存するとローカルのファイルとして書き出されます。
