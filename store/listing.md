# Chrome ウェブストア掲載情報

デベロッパーダッシュボードの各欄にそのまま貼り付けられる文面です。

## ストアの掲載情報

### 拡張機能名
manifest の `extName` から自動で入ります：**Mark Viewport**

### 概要（manifest の `extDescription`、132文字以内）
- ja: Markdownファイル（ローカル・Web上）をGitHub風に整形表示します。目次・ダークモード・自動リロードに対応。
- en: Renders Markdown files (local and on the web) with GitHub-style formatting, a table of contents, and dark mode.

### カテゴリ
デベロッパー ツール（Developer Tools）

### 言語
日本語（デフォルトは英語。両方の掲載文を登録）

### 説明（日本語）

```
Mark Viewport は、ブラウザで開いた Markdown ファイル（.md / .markdown）を、GitHub 風の見やすいレイアウトで表示する拡張機能です。

■ 主な機能
・ローカルの .md ファイルや、Web 上の生テキストの .md を自動で整形表示
・表、タスクリスト、打ち消し線、自動リンク、脚注に対応（GitHub Flavored Markdown）
・コードブロックのシンタックスハイライトとコピーボタン
・Mermaid の図（フローチャート、シーケンス図など）と数式（$…$ / $$…$$ を KaTeX で表示）
・GitHub のアラート（> [!NOTE] など）と絵文字ショートコード（:tada:）
・見出しから自動生成される目次サイドバー（現在位置をハイライト）
・ダークモード（OS の設定に連動、または手動で切り替え）
・ローカルファイルを保存すると表示が自動で更新（エディタと並べてプレビューに便利）
・ワンクリックで元のテキスト（ソース）表示に切り替え
・編集モード（Ctrl+E）：その場でテキストを編集し、プレビュー（Ctrl+Shift+P）で整形結果を確認。Ctrl+S で元のファイルに上書き保存（保存先は初回にファイル選択ダイアログで指定）
・本文の幅、文字サイズを設定で変更可能
・YAML フロントマターは折りたたんで表示

■ ローカルファイルを表示するには
インストール後、chrome://extensions を開き、Mark Viewport の「詳細」から「ファイルの URL へのアクセスを許可する」をオンにしてください。

■ プライバシー
データの収集・送信は一切行いません。ファイルの内容は表示中のタブの中だけで処理されます。編集内容は、ユーザーが選んだファイルにのみ保存されます。
```

### 説明（English）

```
Mark Viewport renders Markdown files (.md / .markdown) opened in your browser with a clean, GitHub-style layout.

Features
• Automatically renders local .md files and raw .md files on the web
• GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks, footnotes
• Syntax highlighting for code blocks, with a copy button
• Mermaid diagrams (flowcharts, sequence diagrams, and more) and math ($…$ / $$…$$, rendered with KaTeX)
• GitHub alerts (> [!NOTE] etc.) and emoji shortcodes (:tada:)
• Table of contents sidebar generated from headings, with the current section highlighted
• Dark mode (follows your OS, or set it manually)
• Auto-reloads local files when you save them — handy as a live preview next to your editor
• One-click toggle to view the original source
• Edit mode (Ctrl+E): edit the text in place, check the rendered result with Preview (Ctrl+Shift+P), and save back to the file with Ctrl+S (you pick the file once in a save dialog)
• Adjustable content width and font size
• YAML front matter is shown collapsed

Viewing local files
After installing, open chrome://extensions, click "Details" on Mark Viewport, and turn on "Allow access to file URLs".

Privacy
Mark Viewport collects and sends no data. File contents are processed only inside the tab that shows them. Edits are saved only to the file you choose.
```

### 画像
| 種類 | サイズ | ファイル |
| --- | --- | --- |
| ストアアイコン | 128×128 | `store/assets/icon-store-128.png` |
| スクリーンショット（1〜5枚） | 1280×800 | `store/assets/screenshot-*.png` |
| プロモーション タイル（小） | 440×280 | `store/assets/promo-small-440x280.png` |

### 追加フィールド
- 公式 URL：任意（Search Console で所有確認したサイトのみ選択可）
- ホームページ URL：https://github.com/zetatechnology/mark-viewport
- サポート URL：https://github.com/zetatechnology/mark-viewport/issues

## プライバシーへの取り組み（Privacy practices タブ）

### 単一用途の説明（Single purpose）
```
ブラウザで開いた Markdown ファイルを整形して表示し、必要に応じてその場で編集・保存できるようにすること。
Render Markdown files opened in the browser as formatted documents, and let the user edit and save them in place.
```

### 権限が必要な理由（Permission justification）

**storage**
```
テーマ・本文の幅・文字サイズ・目次の表示・自動リロードのオン／オフといった表示設定を保存するために使用します。
Used to save display settings (theme, content width, font size, table of contents, auto-reload on/off).
```

**ホスト権限（content script の \*.md / \*.markdown の URL）**
```
URL が .md / .markdown で終わるページにのみ content script を挿入し、そのページがプレーンテキストの Markdown である場合に限り整形表示します。ローカルファイルの自動リロードでは、表示中の同じファイルを非表示の iframe で開き直して変更を検出します。それ以外のページやファイルにはアクセスしません。
A content script is injected only into pages whose URL ends in .md or .markdown, and renders them only when the page is a plain-text Markdown document. For local files, auto-reload re-opens the same file in a hidden iframe to detect saved changes. No other pages or files are accessed.
```

**リモートコードの使用**
```
いいえ。すべてのスクリプトとライブラリはパッケージに同梱しています。
No. All scripts and libraries are bundled in the package.
```

### データの使用（Data usage）
- 収集するユーザーデータの種類：**すべてチェックなし**
- 次の3項目すべてに同意（チェック）する：
  - 承認されている用途以外で、ユーザーデータを第三者に販売、転送しない
  - 単一用途と関係のない目的で、ユーザーデータを使用、転送しない
  - 信用力の判断や融資目的で、ユーザーデータを使用、転送しない

### プライバシー ポリシー URL
https://zetatechnology.github.io/mark-viewport/privacy-policy/
