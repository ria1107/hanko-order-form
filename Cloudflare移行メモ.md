# Netlify → Cloudflare Pages 移行メモ

作成日: 2026-09-07 / 更新日: 2026-09-08(Cloudflare Pages 3サイトとも公開完了、匿名化リネーム実施)
対象: 印鑑注文フォーム3サイト(通常版・松木版・中村版)のホスティング移行(表側の静的サイトのみ。GAS側は変更なし)

## 【2026-09-08 追記2】プロジェクト名・フォルダー名から紹介者の個人名を除去

このリポジトリは`ria1107/hanko-order-form`として**GitHub上で公開**されており、Cloudflareのプロジェクト名も公開URLの一部になる。紹介者「松木さん」「中村さん」という個人名が外部から見える識別子(URL・フォルダー名)に残るのを避けるため、社長指示で以下の通り統一した。

| 版 | 旧フォルダー名 | 新フォルダー名 | 旧Cloudflareプロジェクト名 | 新Cloudflareプロジェクト名 |
|---|---|---|---|---|
| 通常版 | `docs/` | (変更なし) | `f3-hanko-order` | (変更なし) |
| 中村版(送料無料) | `docs-nakamura/` | **`docs-02/`** | `f3-hanko-order-nakamura` | **`f3-hanko-order-02`**(社長がダッシュボードでリネーム。デプロイ履歴が完全一致することを確認済み、データ影響なし) |
| 松木版(翌営業日発送) | `docs-matsuki/` | **`docs-03/`** | `f3-hanko-order-matsuki` | **`f3-hanko-order-03`**(くろちゃんが削除→作り直し) |

フォルダー名は`git mv`でリネーム(履歴は保持)。README.mdのパス表記も合わせて更新済み。**本文中の「松木様」「中村様」といった業務説明の記述自体は、GASの分岐ロジックを理解するための内部ドキュメントとして残してある**(削除していない)。

**副作用**: 旧フォルダー名`docs-matsuki`/`docs-nakamura`をNetlify側が引き続きBase directoryとして参照している場合、次にNetlifyが自動ビルドを試みた際に「フォルダーが見つからない」でビルド失敗する可能性がある。ただしNetlifyは失敗時も直前の成功ビルドを配信し続けるため、**今すぐ表示が消えることはない**。いずれNetlifyを停止する予定なので実害は無い想定。

**重要な発見**: Cloudflareダッシュボードでプロジェクト名を変更しても、実際の公開URL(`.pages.dev`)は変わらない(作成時の名前のまま固定)。そのため`f3-hanko-order-02`にリネームしても、実際のURLは今も`f3-hanko-order-nakamura.pages.dev`のまま。プロジェクト削除→再作成は安全装置でブロックされたため、**代わりに独自ドメイン(Custom domains)を追加し、そちらだけを先生方に案内する方式**で解決することにした(社長承認済み・2026-09-08)。

- 中村版: `order2.f-3.jp` → CNAME先 `f3-hanko-order-nakamura.pages.dev`
- 松木版: `order3.f-3.jp` → CNAME先 `f3-hanko-order-matsuki.pages.dev`
- ドメイン`f-3.jp`はお名前.comで管理(お名前.com Naviの「DNS設定」からCNAME追加)。Cloudflare側は各プロジェクトの「Custom domains」タブから追加。どちらもブラウザでのログイン操作が必要なため社長作業待ち(2026-09-08時点で未実施)。

## 【2026-09-08 追記】Cloudflare Pages公開完了

社長が`nishimoto@f-3.jp`でCloudflareアカウント作成 → `wrangler login`でCLI連携 → くろちゃんが`wrangler pages project create`/`wrangler pages deploy`で3プロジェクトを作成・公開。全サイトHTTPステータス200・タイトル表示を確認済み(下記5.参照)。

**ダッシュボードでのGitHub連携は今回未実施**(CLIから直接アップロードする方式で公開した)。そのため、**今後リポジトリの`docs`/`docs-matsuki`/`docs-nakamura`を更新しても自動では反映されない**。更新のたびに以下のいずれかが必要:
- 手動: `npx wrangler pages deploy <docsフォルダー> --project-name=<プロジェクト名> --branch=main --commit-dirty=true`
- または後日、Cloudflareダッシュボードで各プロジェクトに「Connect to Git」を追加すれば、以後は`git push`で自動反映されるようになる(旧Netlifyと同じ運用に戻せる。おすすめ)

## 背景

Netlifyの無料枠(転送量など)を使い切り、フォームが表示できなくなるリスクが出たため、
無料のまま商用利用でき転送量が無制限のCloudflare Pagesへ引っ越す(社長承認済み)。

---

## 1. 現状構成の確認結果

リポジトリ直下と`docs-matsuki/` `docs-nakamura/`それぞれに`netlify.toml`があることを確認した。
これは**Netlifyで3つの独立したサイトを作っていた証拠**(1サイト1設定ファイル)。

| フォルダー | netlify.tomlの中身 | 対応するNetlifyサイトの公開ディレクトリ |
|---|---|---|
| リポジトリ直下 | `[build] publish = "docs"` | サイトのbase directory＝リポジトリ直下、公開フォルダー＝`docs` |
| `docs-matsuki/` | `[build] publish = "."` | サイトのbase directory＝`docs-matsuki`、公開フォルダー＝そのまま自分自身 |
| `docs-nakamura/` | `[build] publish = "."` | サイトのbase directory＝`docs-nakamura`、公開フォルダー＝そのまま自分自身 |

→ **3サイト構成という前提は設定ファイルから裏付けが取れた**(ダッシュボードを見なくても確認できた)。

### 各サイトが独立して完結しているか

- 中身は`index.html`と`tokushoho.html`(特定商取引法ページ)の2ファイルのみ、3フォルダーとも同じ構成
- 画像はすべてGoogle Driveの外部リンク(`drive.google.com/thumbnail?id=...`)。フォルダー内に画像ファイルは無い
- 郵便番号検索は外部API(`zipcloud.ibsnet.co.jp`)を直接呼んでいる
- 注文送信先(`API_URL`)はサイトごとに異なるGAS Web AppのURLがJS内に直書きされている(通常版・松木版・中村版で別URL)
- 3フォルダーのどこにも`../`で親ディレクトリを参照する記述は無い(`grep`で確認済み)

→ **3サイトとも他のフォルダーに依存せず、単独でそのままCloudflare Pagesに載せ替え可能**と確認した。

---

## 2. Cloudflare Pages移行に必要な設定変更

### Netlify固有の設定に、Cloudflareが読めない/不要な記述はあるか

3つの`netlify.toml`はすべて`[build] publish = "..."`の1行のみ。リダイレクトルール(`[[redirects]]`)やカスタムヘッダーの定義は無く、`_redirects`ファイル・`_headers`ファイルもリポジトリ内に存在しない(`find`で確認済み)。

→ **移植すべきNetlify固有の設定は実質ゼロ**。Cloudflare Pages側で書き換えが必要な記述は見つからなかった。

### リポジトリに追加すべき設定ファイルは要るか

Cloudflareの公式ドキュメント(モノレポ機能)によると、GitHub連携でPagesプロジェクトを作る場合、
**「ビルド出力ディレクトリ(Build output directory)」をダッシュボード側で指定するだけ**で、1つのリポジトリから複数プロジェクトを作れる。`wrangler.toml`はGitHub連携方式では読み込まれず不要。CLIで手動デプロイする場合(`wrangler pages deploy <フォルダー名> --project-name=<プロジェクト名>`)も、フォルダー名とプロジェクト名をコマンドの引数で渡せるため設定ファイルは必須ではない。

→ **今回、リポジトリ側に追加で置くべき必須の設定ファイルは無い**という判断。中途半端な`wrangler.toml`を置くと将来Pages Functionsなどを使う際に混乱の元になりかねないため、あえて追加しなかった。ダッシュボードでの設定値は下記3.の表のとおり。

---

## 3. Cloudflare Pages側の設定値(ダッシュボードで入力する値)

1つのGitHubリポジトリ(`ria1107/hanko-order-form`)から、以下の3つのPagesプロジェクトを作成する。

| プロジェクト名 | Production branch | Framework preset | Build command | Build output directory | 対応サイト |
|---|---|---|---|---|---|
| `f3-hanko-order` | `main` | None | (空欄) | `docs` | 通常版 |
| `f3-hanko-order-03` | `main` | None | (空欄) | `docs-03` | 松木版 |
| `f3-hanko-order-02` | `main` | None | (空欄) | `docs-02` | 中村版 |

(2026-09-08時点で確定した名称。個人名を含まない番号方式に統一済み)

Root directoryはどのプロジェクトも変更不要(リポジトリ直下`/`のまま)。Build output directoryだけ変えればよい。

---

## 4. ローカル環境のCloudflare認証状況(確認結果)

- `wrangler`コマンド: 未インストール(`npx wrangler`で一時実行は可能。v4.129.0が使える状態)
- `~/.wrangler`フォルダー: 存在しない
- 環境変数`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`: 未設定
- `wrangler whoami`: 「You are not authenticated」(未ログイン)

→ **ヘッドレスでデプロイできる状態ではない**ため、今回`wrangler pages deploy`によるテスト公開は実施していない(依頼内容の手順4は「既にあれば実行」という条件付きだったため、条件を満たさず未実施)。アカウント作成・GitHub連携はブラウザでの人手作業が必要(下記5.)。

---

## 5. アカウント作成〜GitHub連携の手順(社長またはくろちゃんがブラウザで実施)

1. https://dash.cloudflare.com/sign-up にアクセスし、メールアドレスとパスワードで新規Cloudflareアカウントを作成(既存のCloudflareアカウントがあればログインするだけでOK)
2. 届いた確認メールのリンクをクリックしてメール認証を完了する
3. ログイン後、左メニューの「Workers & Pages」を開く
4. 「Create application」→「Pages」タブ→「Connect to Git」を選択
5. 初回はGitHubとの連携(OAuth認証)が必要。「Connect GitHub」→GitHubにログインして権限を許可する
   - リポジトリ選択で「Only select repositories」を選び、`ria1107/hanko-order-form`だけを許可するのが安全(全リポジトリへのアクセス権を渡さなくて済む)
6. 連携できたら`ria1107/hanko-order-form`を選んで「Begin setup」
7. プロジェクト名を入力(例: `f3-hanko-order`)。Production branchは`main`のまま
8. 「Build settings」で以下を入力:
   - Framework preset: `None`
   - Build command: 空欄のまま
   - Build output directory: `docs`
9. 「Save and Deploy」を押すと数十秒でデプロイされ、`https://f3-hanko-order.pages.dev`が発行される
10. 同じリポジトリに対して手順4〜9をあと2回繰り返す。プロジェクト名とBuild output directoryだけ以下のように変える
    - 2回目: プロジェクト名`f3-hanko-order-matsuki` / Build output directory`docs-matsuki`
    - 3回目: プロジェクト名`f3-hanko-order-nakamura` / Build output directory`docs-nakamura`
11. 3プロジェクトとも、発行されたURLをブラウザで開いてフォームが正しく表示されるか確認する

---

## 6. 今の本番URL(移行前の記録)

| サイト | Netlify本番URL | 確認状況 |
|---|---|---|
| 通常版(行政書士様向け) | `https://f3-hanko-order.netlify.app` | Notion「DB_アプリURL台帳」に登録済み・状態「現役」で確認できた |
| 松木版 | **不明** | 台帳側にも「Netlify管理画面で要確認」と記載されたまま。ローカルの過去プロジェクトファイル・報告履歴にも記載が見当たらなかった |
| 中村版(送料無料) | **不明** | 同上 |

→ 松木版・中村版のNetlify公開URLは、`https://app.netlify.com` のダッシュボードにログインしないとくろちゃん側では確認できない(ブラウザでのログインが必要なため)。**Cloudflare移行の前に、まずこの2つの現URLをNetlify管理画面で確認・記録することを推奨**(でないと「今どのURLを先生方に案内しているか」が特定できないまま切り替えることになる)。

---

## 7. 新URL案(Cloudflare Pages)

プロジェクト名をそのまま使うと、Cloudflareの標準ドメイン`https://<プロジェクト名>.pages.dev`が発行される。

- 通常版: `https://f3-hanko-order.pages.dev`
- 松木版: `https://f3-hanko-order-03.pages.dev`
- 中村版: `https://f3-hanko-order-02.pages.dev`

通常版はすでに先生方に`f3-hanko-order.netlify.app`を案内済みの可能性が高いため、**URLが変わる**。独自ドメイン(例: `order.f-3.jp`など)をCloudflare側で追加すれば、案内URLを固定化できる(今回は提案のみで未設定)。

---

## 8. 残作業(次にやること)

1. ~~松木版・中村版のNetlify公開URLをNetlify管理画面で確認~~ → **不要になった**。Cloudflare側の新URLに切り替えるため、旧URLは記録のみで十分(下記9.)
2. ~~Cloudflareアカウントを新規作成し、GitHub連携する~~ → **完了**(2026-09-08、CLIでの直接デプロイ方式。GitHub連携は未実施、上記の追記参照)
3. ~~ダッシュボードで3プロジェクトを作成~~ → **完了**(2026-09-08、CLIで作成)
4. ~~3サイトとも実機で表示確認~~ → **完了**(HTTPステータス200・タイトル一致を確認)。**テスト注文1件を通しで確認(GASのSlack通知・スプレッドシート記帳まで)はまだ未実施** → 実施する場合は社長に一声かけてから
5. 先生方への案内URLを変更する場合、いつ・どう周知するかを社長と相談(独自ドメイン設定も含めて検討)。Notion「DB_アプリURL台帳」の更新も要確認のうえ実施
6. 問題なければ社長の最終確認を得たうえでNetlify側を停止・削除(今回は未実施。指示があるまで着手しない)

## 9. 新URL(公開済み・2026-09-08時点)

| サイト | 新URL(Cloudflare Pages) | 旧URL(Netlify・現在も稼働中) |
|---|---|---|
| 通常版 | https://f3-hanko-order.pages.dev | https://f3-hanko-order.netlify.app |
| 松木版 | https://f3-hanko-order-matsuki.pages.dev | 不明(Netlify管理画面要確認) |
| 中村版(送料無料) | https://f3-hanko-order-nakamura.pages.dev | 不明(Netlify管理画面要確認) |
