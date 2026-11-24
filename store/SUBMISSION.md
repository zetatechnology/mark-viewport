# Chrome ウェブストア提出チェックリスト

## 用意済みのもの

| もの | 場所 | 作り直すコマンド |
| --- | --- | --- |
| 提出用 zip | `mark-viewport.zip`（git 管理外） | `npm run zip` |
| ストアアイコン 128×128 | `store/assets/icon-store-128.png` | `npm run icons` |
| スクリーンショット 1280×800 ×3 | `store/assets/screenshot-*.png` | `npm run store-assets` |
| プロモーション タイル（小）440×280 | `store/assets/promo-small-440x280.png` | `npm run store-assets` |
| 掲載文・権限の説明・データ使用の回答 | `store/listing.md` | — |
| プライバシーポリシー | `docs/privacy-policy.md` → https://zetatechnology.github.io/mark-viewport/privacy-policy/ | main に push すると GitHub Pages に自動反映 |
| サードパーティのライセンス表記 | zip 内の `THIRD_PARTY_NOTICES.txt` | `npm run build` で自動生成 |

スクリーンショットは `store/demo.md`（ライト・ソース表示）と `store/demo-notes.md`（ダーク）を、実際の content script で描画したものです。

提出前に、次の2つを実行して両方とも成功することを確認してください（`npm run build` のあと）。

- `node scripts/e2e.mjs`：`test/sample.md` の描画結果（見出し、Mermaid の図、数式、アラート、コピーボタン）と、コンソールのエラーを確認します。
- `node scripts/e2e-reload.mjs`：ローカルファイルを書き換えて、自動リロードで表示に反映されるかを確認します。

編集モードの保存（ファイル選択ダイアログと書き込み許可の確認）はヘッドレスでは自動化できないので、Chrome に `dist/` を読み込み、ローカルの .md で「編集 → 書き換え → Ctrl+S → 再度 Ctrl+S（ダイアログなしで上書き）」を手で確認してください。

どちらも、ビルドした拡張機能を Edge のヘッドレスモードに読み込んで動かします。Chrome 本体はコマンドラインからの拡張機能の読み込みを受け付けないためです。使うブラウザは環境変数 `CHROME_PATH` で変えられます。

`web_accessible_resources` に `use_dynamic_url` を付けないでください。付けると、Mermaid の分割ファイルや KaTeX のフォントが読み込めなくなります（`e2e.mjs` で検出できます）。

## 提出前に決めること・やること

- [ ] **公開するアカウント**：個人アカウントか、会社（zetatechnology）として公開するか。会社で複数人が管理するなら、Google グループを使った「グループ パブリッシャー」にしておくと担当者が変わっても引き継げます。
- [ ] **デベロッパー登録**（ご自身で）：[デベロッパー ダッシュボード](https://chrome.google.com/webstore/devconsole) で登録し、登録料（一度だけ）を支払います。Google アカウントに 2 段階認証が必要です。
- [ ] **トレーダー申告**（EU 向け）：会社として公開する場合は「トレーダー」を選び、住所・電話番号・メールアドレスを登録します（EU のユーザーに表示されます）。個人の非商用なら「非トレーダー」です。
- [x] **プライバシーポリシーの公開 URL**：https://zetatechnology.github.io/mark-viewport/privacy-policy/ （GitHub Pages、`main` ブランチの `docs/`）
- [ ] **連絡先**：問い合わせ先は GitHub Issues（https://github.com/zetatechnology/mark-viewport/issues）にしています。ダッシュボードの「サポート URL」にも同じ URL を設定します。
- [x] **バージョン**：1.0.0（`public/manifest.json` と `package.json`）

## ダッシュボードでの手順

1. 「新しいアイテム」→ `mark-viewport.zip` をアップロード
2. **ストア掲載情報**：`store/listing.md` の説明（日本語・英語）、カテゴリ、画像を登録
3. **プライバシーへの取り組み**：単一用途、権限の理由、リモートコード「いいえ」、データ使用（すべてチェックなし ＋ 3 つの同意）、プライバシーポリシー URL
4. **配布**：公開範囲（公開 / 限定公開 / 非公開）、地域（すべての地域）
5. 「審査のため送信」。審査は通常、数日〜数週間かかります。

## 審査で指摘されやすい点

- **ホスト権限の範囲**：content script が `http://*/*.md*` と `https://*/*.md*` に入るため、インストール時に「すべてのサイトのデータの読み取りと変更」に近い警告が出る可能性があり、審査が長くなる傾向があります。説明文と権限の理由で「.md の URL にだけ入り、プレーンテキストの Markdown のときだけ動作する」ことを明確にしています。
- **ローカルファイル**：「ファイルの URL へのアクセスを許可する」はユーザーが手動で ON にする必要があります。説明文に手順を記載済みです。

## 更新を出すとき

1. `public/manifest.json` の `version` を上げる（同じ番号では再提出できません）
2. `npm run zip`
3. ダッシュボードの「パッケージ」から新しい zip をアップロードし、審査に送信
