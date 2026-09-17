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

---

## 【2026-09-14 障害と復旧】通常版・中村版が404になっていた(D-019)

### 症状
社長から「印鑑のフォームが使えなくなっている」と報告。`https://f3-hanko-order.pages.dev` がブラウザで **HTTP ERROR 404**。

### 実測した状態(2026-09-14)
| サイト | URL | 障害時 | 復旧後 |
|---|---|---|---|
| 通常版 | https://f3-hanko-order.pages.dev | ❌ 404 | ✅ 200 |
| 中村版 | https://f3-hanko-order-nakamura.pages.dev | ❌ 404 | ✅ 200 |
| 松木版 | https://f3-hanko-order-matsuki.pages.dev | ✅ 200 | ✅ 200 |
| 旧Netlify(通常版) | https://f3-hanko-order.netlify.app | ✅ 200(生存) | ✅ 200 |
| order2.f-3.jp / order3.f-3.jp | — | DNS未設定(名前解決せず)。独自ドメインは結局未実施のまま |

### 原因(デプロイ履歴から特定)
`wrangler pages deployment list` で各デプロイを1つずつ叩いて切り分けた結果、**同じコミットでも「CLI直接デプロイは中身あり・GitHub連携の自動ビルドは空」**という明確なパターンが出た。

| プロジェクト | デプロイ | ソース | 実測 |
|---|---|---|---|
| f3-hanko-order | 169d810f(6日前・CLI) | 522e7fc | ✅ 200 |
| f3-hanko-order | 5a0f6b1d(CLI) | aabcf33 | ✅ 200 |
| f3-hanko-order | cfdb1f59(Git自動) | aabcf33 | ❌ 404 |
| f3-hanko-order | **827d6524(Git自動・本番に割当)** | 8d9dce5 | ❌ **404** |
| f3-hanko-order-03(松木) | 4e023b6c(Git自動) | 8d9dce5 | ✅ 200 |

→ 9/8以降に各プロジェクトへ **GitHub連携(Connect to Git)が追加された**が、`f3-hanko-order`(通常版)と`f3-hanko-order-02`(中村版)は **Build output directory の設定が正しくない**ため、自動ビルドが空の成果物を公開し、それが本番デプロイとして上書きされた。松木版(`f3-hanko-order-03`=出力`docs-03`)だけは設定が合っていたため無傷だった。

**注意: フォーム本体(index.html)は一切壊れていない。**ローカルの`docs/` `docs-02/` `docs-03/`は3版とも無傷で、「空の箱」が本番に差し替わっただけ。

### 実施した復旧(2026-09-14、社長承認のうえ実行)
```
npx wrangler pages deploy docs     --project-name=f3-hanko-order    --branch=main --commit-dirty=true
npx wrangler pages deploy docs-02  --project-name=f3-hanko-order-02 --branch=main --commit-dirty=true
```
実行後、3サイトともHTTP 200 + `<title>`表示を確認済み。

### ⚠️ 未解決(次にやること)
**Build output directory の設定を直さない限り、次に`git push`した時点でまた空ビルドに上書きされて404が再発する。**ダッシュボードでの操作が必要(ブラウザ作業のため社長かブラウザ操作時に実施):

1. https://dash.cloudflare.com/3f088a3ce73b0cfaa33e70a6dd92c30f/pages/view/f3-hanko-order/settings/builds-deployments
   → Build output directory を **`docs`** に(Build commandは空欄、Root directoryは`/`のまま)
2. 同様に `f3-hanko-order-02` → **`docs-02`**
3. (参考)`f3-hanko-order-03` は **`docs-03`**。ここは既に正しいはず
4. 直したら、ダミーの`git push`かダッシュボードの「Retry deployment」で自動ビルドが成功するか確認する

代替案: GitHub連携を解除して、更新のたびに上記`wrangler pages deploy`を手動実行する運用に戻す(くろちゃんが実行できる)。連携のメリット(pushで自動反映)を取るなら1〜3の設定修正が必要。

---

## 【2026-09-18 追記】D-024関連: 開発課依頼「6フォーム整理」実施記録

社長から開発課(くろちゃん自身が直接実行)への依頼で、F3の6注文フォーム全体(印鑑3種・らくぽん・スタンプ・LST予約)について
①不要プロジェクト削除 ②印鑑フォームの404再発リスク解消 ③独自ドメイン設定 を実施した。

### 1. Build output directory 問題 → **API経由で修正・解決**

**重要な発見: Cloudflare REST APIならCLI/curlだけで`destination_dir`(Build output directory)を読み書きできた。ダッシュボード操作は不要だった。**

認証には`wrangler login`済みのOAuthトークンをそのまま使える(`~/Library/Preferences/.wrangler/config/default.toml`の`oauth_token`)。

```bash
# 読み取り
curl -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/f3-hanko-order"

# 書き込み(PATCH)
curl -X PATCH -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{"build_config":{"destination_dir":"docs"}}' \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/f3-hanko-order"
```

確認したところ、`f3-hanko-order`は`destination_dir=docs`、`f3-hanko-order-02`は`destination_dir=docs-02`と**すでに正しい値になっていた**(前回2026-09-14の障害以降、いつの間にか正しく設定されていた。社長がダッシュボードで直された可能性)。念のためAPI経由で同じ値を再設定(PATCH)し、書き込み権限があることも確認した。現状の本番URLは3版とも実際のフォーム内容(空ビルドではない)を配信中であることをcurlで確認済み。

**今後もし再発したら**、ダッシュボード操作(下記の旧手順)を使わずとも、上記のAPI PATCHコマンドで直せる。

### 2. 独自ドメイン(Custom domains)追加 → **API経由で6件とも追加成功、DNS待ち**

Cloudflare Pages Custom Domains APIで6プロジェクトすべてにドメインを追加できた:

```bash
curl -X POST -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"order.f-3.jp"}' \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/f3-hanko-order/domains"
```

| フォーム | プロジェクト名 | 独自ドメイン | 状態(2026-09-18時点) |
|---|---|---|---|
| 印鑑注文(通常版) | f3-hanko-order | order.f-3.jp | Cloudflare側は追加済み・`pending`(CNAME record not set) |
| 印鑑注文(中村版) | f3-hanko-order-02 | order2.f-3.jp | 同上 |
| 印鑑注文(松木版) | f3-hanko-order-03 | order3.f-3.jp | 同上 |
| らくぽんゴルフ通販 | f3-rakupon-order | rakupon.f-3.jp | 同上 |
| スタンプ注文 | f3-stamp-order | stamp.f-3.jp | 同上 |
| LST撮影会予約 | f3-lst-reservation | lst.f-3.jp | 同上(**表示確認のみ、注文APIへのテスト送信なし**) |

Cloudflare側の追加は完了したが、`f-3.jp`のネームサーバーは今も`ns-rs1/ns-rs2.gmoserver.jp`(お名前.com)のままで、6つのサブドメインとも`dig`でCNAME未設定(何も返らない)を確認。**次はお名前.com側でCNAMEを追加する人間作業が必要**(下記3.)。

### 3. お名前.com側でのCNAME設定(★人間の作業が必要)

お名前.com Navi(https://navi.onamae.com/ )にログイン → 「DNS」→「DNS設定/転送設定」→ `f-3.jp`を選択 → 「DNS設定」→「入力方法選択」で以下6行を追加する。

| ホスト名 | TYPE | VALUE(CNAME先) |
|---|---|---|
| order | CNAME | f3-hanko-order.pages.dev |
| order2 | CNAME | f3-hanko-order-nakamura.pages.dev |
| order3 | CNAME | f3-hanko-order-matsuki.pages.dev |
| rakupon | CNAME | f3-rakupon-order.pages.dev |
| stamp | CNAME | f3-stamp-order.pages.dev |
| lst | CNAME | f3-lst-reservation.pages.dev |

**注意**: order2/order3のCNAME先はプロジェクト名(`f3-hanko-order-02`/`-03`)ではなく、**作成時に発行された実際の`.pages.dev`**(`-nakamura`/`-matsuki`)なので要注意(2026-09-08の追記に記載の通り、ダッシュボードでプロジェクト名だけリネームしても実URLは変わらない)。

手順(お名前.com Navi、高校生向け):
1. https://navi.onamae.com/ にアクセスし、お名前.com IDでログイン
2. 上部メニュー「ドメイン」→「ドメイン機能一覧」を開く
3. 一覧から対象ドメイン`f-3.jp`にチェックを入れる
4. 「DNS関連機能設定」欄の「DNS設定/転送設定」を選択→「設定する」ボタン
5. 対象ドメイン`f-3.jp`の「DNS設定」リンクをクリック
6. 「DNSレコード設定を利用する」の「設定する」を押す
7. 画面下の入力欄で、ホスト名に`order`、TYPEで`CNAME`を選択、VALUEに`f3-hanko-order.pages.dev`(末尾のピリオドは不要)を入力し「追加」
8. 同様に残り5行(order2/order3/rakupon/stamp/lst)を追加
9. 一番下の「確認画面へ進む」→内容を確認して「設定する」
10. 反映まで数分〜数時間(最大24時間程度)。反映後、`https://order.f-3.jp`等をブラウザで開いてフォームが表示されればOK。Cloudflare側は自動でSSL証明書を発行し`status`が`active`に変わる(ダッシュボードのCustom domainsタブで確認可能)

反映確認は`dig order.f-3.jp CNAME +short`やブラウザアクセスで可能(くろちゃんでも巡回時に確認できる)。

### 4. 不要プロジェクトの削除

`f3-prudential-stamp-order`はフィッシング誤検知で403ブロック済み・2026-09-15に`f3-stamp-order`へ完全移行済み(README.mdの案内URLも切替済み)であることを確認し、`wrangler pages project delete f3-prudential-stamp-order`で削除した。削除後は404ではなく530(存在しないPagesドメイン)を返すことを確認。詳細は`会社基盤/products/スタンプ注文_保険代理店様向け/Cloudflare移行メモ.md`参照。

### 5. 品質チェック結果(2026-09-18実施分、全てcurlの表示確認のみ)

| サイト | HTTPステータス |
|---|---|
| f3-hanko-order.pages.dev | 200 |
| f3-hanko-order-nakamura.pages.dev(中村版実URL) | 200 |
| f3-hanko-order-matsuki.pages.dev(松木版実URL) | 200 |
| f3-rakupon-order.pages.dev | 200 |
| f3-stamp-order.pages.dev | 200 |
| f3-lst-reservation.pages.dev | 200(**送信ボタンは押していない**) |
| f3-prudential-stamp-order.pages.dev(削除後) | 530(プロジェクト不存在。想定通り) |

### 残作業

1. お名前.comで上記6件のCNAMEを追加(社長 or ブラウザ操作時のくろちゃん)
2. DNS反映・Cloudflare側の`status`が`active`になったことを確認
3. 独自ドメインが安定稼働したら、案内URL切替のタイミングを社長と相談し、Notion「DB_アプリURL台帳」を更新
4. 印鑑フォームのBuild output directoryは今回API経由で正常値を再確認・再設定したが、**GitHub連携の自動ビルドが将来また空ビルドを作らないか、次回のgit push後に一度実機確認することを推奨**
