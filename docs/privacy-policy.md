---
title: Privacy Policy
permalink: /privacy-policy/
---

# Mark Viewport プライバシーポリシー / Privacy Policy

最終更新日 / Last updated: 2026-11-24

## 日本語

Mark Viewport（以下「本拡張機能」）は、ブラウザで開いた Markdown ファイルを整形して表示するための Chrome 拡張機能です。

### 収集する情報

本拡張機能は、個人情報・閲覧履歴・ファイルの内容を含む**いかなるデータも収集、送信、販売、共有しません**。

### 処理する情報

- **表示中の Markdown ファイルの内容**：整形表示のために、表示しているタブ内でのみ処理します。外部のサーバーには送信しません。
- **ローカルファイルの再読み込み**：自動リロード機能が有効な場合、表示中のローカルファイル（`file://`）を拡張機能が読み直し、変更を反映します。読み込んだ内容はそのタブでの表示にのみ使います。
- **設定**：テーマや文字サイズなどの設定は `chrome.storage.sync` に保存します。Chrome の同期機能が有効な場合、Google アカウントを通じてユーザーの他の端末と同期されることがあります。開発者はこのデータにアクセスできません。

### 外部通信

本拡張機能は、アクセス解析、広告、外部 API への通信を一切行いません。必要なライブラリはすべて拡張機能に同梱しています。

### お問い合わせ

本ポリシーに関するお問い合わせは、[GitHub Issues](https://github.com/zetatechnology/mark-viewport/issues) までお寄せください。

### 改定

本ポリシーを変更する場合は、このページで告知します。

---

## English

Mark Viewport ("the extension") is a Chrome extension that renders Markdown files opened in the browser.

### Data collection

The extension **does not collect, transmit, sell, or share any data**, including personal information, browsing history, or file contents.

### Data processed

- **Content of the Markdown file being viewed** is processed only inside the tab that displays it, to render it. It is never sent to any server.
- **Local file reloading**: when auto-reload is on, the extension re-reads the local file (`file://`) currently shown in a tab to reflect changes. The content is used only to update that tab.
- **Settings** (theme, font size, etc.) are stored with `chrome.storage.sync`. If Chrome sync is enabled, Chrome may sync them across your devices through your Google account. The developer has no access to this data.

### Network communication

The extension uses no analytics, no advertising, and no external APIs. All libraries are bundled with the extension.

### Contact

For questions about this policy, please open an issue on [GitHub Issues](https://github.com/zetatechnology/mark-viewport/issues).

### Changes

Any changes to this policy will be posted on this page.
