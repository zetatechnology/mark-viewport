# Mark Viewport

Markdown ファイル（`.md` / `.markdown`）をブラウザ上で GitHub 風に整形表示する Chrome 拡張機能（Manifest V3）です。

## 機能

- ローカルファイル（`file:///…/README.md`）と Web 上の生テキストの .md（例: `raw.githubusercontent.com`）を自動で整形表示
- GFM：表、タスクリスト、打ち消し線、自動リンク、脚注
- コードのシンタックスハイライト（highlight.js の主要言語）
- 目次サイドバー（現在位置をハイライト）、見出しへのアンカーリンク
- ダークモード（OS に連動 / 手動）、本文幅・文字サイズの設定
- 「ソース」ボタンまたはツールバーアイコンで元のテキストに切替
- ローカルファイルの自動リロード（保存すると反映）
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
- Mermaid と数式（KaTeX）は未対応です。

## Chrome Web Store 公開に向けたメモ

- `npm run zip` で `mark-viewport.zip` が作られます（`dist/` の中身を圧縮したもの）。
- 権限は `storage`、`file:///*`（自動リロード用）、content script の `.md` / `.markdown` URL のみです。審査フォームに書く権限の理由:
  - **storage**：表示設定の保存
  - **ホスト権限（file:///\*）**：ローカルの Markdown ファイルを読み直して、変更を反映するため
  - **content script（\*.md, \*.markdown）**：Markdown ファイルを整形表示するため
- リモートコードは使用していません（すべてのライブラリを同梱しています）。データの収集もありません。プライバシー欄では「データを収集しない」を選べます。
- ストアには別途、スクリーンショット（1280×800 または 640×400）、プロモーション用タイル（440×280）、プライバシーポリシーの URL（データを収集しない旨の 1 ページで十分）が必要です。
- 「ファイルの URL へのアクセスを許可する」はインストール後にユーザー自身が ON にする必要があります。ストアの説明文にも書いておきましょう。
