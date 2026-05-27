# リアルタイム共同メモアプリ 設計書

> このファイルはリポジトリルートに配置し、コードと同期して管理する。
> 変更時は必ず「7. 更新履歴」に記録すること。

---

## 1. 技術スタックとバージョン

### 採用技術一覧

| レイヤー | 技術 | バージョン | 選定理由 |
|---|---|---|---|
| ランタイム | Node.js | 24.16.0 (LTS) | 最新LTS。現行24.3.0からアップグレードして開発開始 |
| フロントエンド | Vanilla JS (ESM) | ES2022+ | TypeScriptは別プロジェクト扱い。純粋なJSでロードマップを網羅する |
| ビルドツール | Vite | 6.x (latest) | ESM対応・HMR・開発サーバーが標準搭載。設定が最小限で済む |
| バックエンド | Node.js + Express | Express 5.x | 軽量・実績あり。ミドルウェア設計でルーティング学習に適する |
| WebSocket | ws | 8.x | ブラウザ標準WebSocket APIと対になるサーバー側実装。依存が少ない |
| データベース | SQLite | better-sqlite3 12.x | 同期APIのためasync/awaitと組み合わせて非同期制御を明示的に学べる。ファイル1本で永続化。Node.js 24対応のため9.xから12.xにアップグレード |
| テスト | Vitest | 2.x | Viteと統合済み。ESMネイティブ対応 |
| Lint | ESLint | 9.x (flat config) | 現在の標準構成。`.eslintrc`は非推奨のためflat config採用 |
| CI | GitHub Actions | - | 業界標準。ローカル開発のためデプロイジョブは含まない |

### 競合技術の選定方針

| 競合ペア | 採用 | 非採用 | 理由 |
|---|---|---|---|
| ESM vs CommonJS | ESM | CommonJS | Node.js 22以降でデフォルト。現在の標準 |
| Fetch vs XMLHttpRequest | Fetch API | XMLHttpRequest | Promise対応・現在の標準。XHRはコード内NOTEコメントで言及のみ |

---

## 2. アーキテクチャの決定とその理由

### 全体構成

```
ブラウザ (SPA)
    ↕ HTTP (REST API)     メモのCRUD・認証・共有リンク発行
    ↕ WebSocket           保存アクション単位のリアルタイム同期
Express サーバー (Node.js)
    ↕ better-sqlite3 (同期)
SQLite ファイル (data/app.db)
```

**SPAを選択した理由**
- WebSocket接続をページ遷移なしで維持できる
- DOM APIをフロント側で集中的に学習できる
- History APIによるルーティングをJSで実装できる（ロードマップ網羅）

**SQLiteを選択した理由**
- JSONファイルより「構造化データ・トランザクション・非同期DB操作」をより深く学べる
- `better-sqlite3`の同期APIとPromiseを組み合わせることで、同期/非同期の違いを明示的に体験できる

### FlutterのMVVMとの対応（Flutter経験者向け）

Flutter（MVVM）とこのアプリ（MVP）は役割の名前が違うが、本質的な3層構造は同じ。
**最大の違いは「Model層の先に何があるか」**。

| Flutter (MVVM) | このアプリ (MVP) | 役割 |
|---|---|---|
| View | views/ | 画面描画・ユーザー操作の受付 |
| ViewModel | presenters/ | ロジック・状態管理・橋渡し |
| Model / Repository | models/ | データ取得・APIコール |
| 外部サーバー（Firebase等） | server/（自前） + data/app.db | データの永続化 |

Flutterでは **Model層が外部サーバーとの境界線** だった。
このアプリでは **models/ はブラウザ内に残り、その先に自前のサーバー層・DB層が続く**。
サーバー層（server/）はNode.jsがあなたのMac自体をサーバーにすることで実現する。
ブラウザは `data/app.db` の存在を知らず、必ずサーバーを経由してDBにアクセスする。

> **NOTE（次のステップ）:** このアプリの後にReactで開発する場合、変わるのはブラウザ層の書き方だけ。
> サーバー層・DB層はそのまま使い回せる。ReactはVanilla JSのDOM操作を自動化したものなので、
> 先にDOM操作を手で書いた経験がReactの理解に直結する。

---

### フロントエンドアーキテクチャ：MVPパターン

ロジックとViewを分離するため、**MVPパターン（Model-View-Presenter）**を採用する。

```
[ Model ]                [ Presenter ]              [ View ]
データ・              ←→  ロジックの仲介役        ←→  DOM操作のみ
ビジネスロジック           ViewとModelをつなぐ          描画・イベント通知
APIアクセス               DOMを知らない                ロジックを知らない
状態管理                  テスト対象の中心              テストは最小限でよい
```

**責務の原則**

| レイヤー | やること | やらないこと |
|---|---|---|
| Model | APIコール・データ変換・バリデーションロジック | DOM操作・画面遷移 |
| Presenter | ModelとViewの橋渡し・ユーザー操作への応答 | 直接のDOM操作・APIコール |
| View | DOM生成・更新・イベントのPresenterへの通知 | ビジネスロジック・APIコール |

**採用理由**
- Vanilla JSでフレームワーク不要で実装できる
- ロードマップの「Classes」「Closures」「this」「イベント処理」を自然に学べる
- Presenterがpureなロジックのため、Vitestで単体テストしやすい

### ディレクトリ構成

```
project-root/
├── .github/
│   └── workflows/
│       └── ci.yml
├── client/
│   ├── index.html
│   ├── vite.config.js            # Vite設定（ルートには置かない）
│   └── src/
│       ├── main.js                   # エントリーポイント・DI組み立て
│       ├── router.js                 # History APIベースのSPAルーター
│       ├── api/
│       │   ├── http.js               # Fetch APIラッパー（共通ヘッダ・エラー処理）
│       │   └── socket.js             # WebSocketクライアント管理
│       ├── models/                   # APIアクセス・データ変換（MVPのM）
│       │   ├── authModel.js
│       │   ├── noteModel.js
│       │   ├── folderModel.js
│       │   └── tagModel.js
│       ├── presenters/               # ロジック・橋渡し（MVPのP）
│       │   ├── authPresenter.js
│       │   ├── noteListPresenter.js
│       │   └── noteEditorPresenter.js
│       ├── views/                    # DOM操作のみ（MVPのV）
│       │   ├── authView.js
│       │   ├── noteListView.js
│       │   └── noteEditorView.js
│       ├── store/
│       │   └── store.js              # アプリ全体の状態管理（JWTトークン・ログイン中ユーザー情報・現在表示中のnoteId）
│       └── utils/
│           ├── validator.js          # 入力バリデーション（Model側で使用）
│           └── sanitize.js           # XSS対策サニタイズ（View側で使用）
├── server/
│   ├── index.js                      # サーバーエントリーポイント
│   ├── app.js                        # Expressアプリ定義
│   ├── db/
│   │   ├── connection.js             # DB接続・初期化
│   │   └── migrations/
│   │       └── 001_init.sql
│   ├── routes/
│   │   ├── auth.js
│   │   ├── notes.js
│   │   ├── folders.js
│   │   ├── tags.js
│   │   └── share.js                  # 共有リンク発行・アクセス
│   ├── ws/
│   │   └── handler.js
│   └── middleware/
│       ├── auth.js                   # JWT検証
│       └── errorHandler.js           # 集約エラーハンドラ
├── shared/
│   └── constants.js                  # フロント・サーバー共通定数（エラーコード・WSイベント名等）
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   └── DESIGN.md
├── data/                             # .gitignore対象
├── package.json
└── .gitignore
```

### 主要な設計決定

| 決定事項 | 内容 | 理由 |
|---|---|---|
| フロントアーキテクチャ | MVPパターン | ロジックとView分離。PresenterをDOMなしでテスト可能 |
| 認証方式 | JWT（メモリ保持） | XSS・CSRF両方に強い。ページリロードで再ログインは許容 |
| JWT有効期限 | 15分（期限切れ=再ログイン） | リフレッシュトークンなし構成の業界標準範囲内。操作中に切れすぎない最短値 |
| 同期タイミング | 保存アクション単位（Ctrl+S） | 文字単位同期は競合解決が複雑。学習目的に対してオーバースペック |
| 競合解決 | 後勝ち | OTアルゴリズムは今回のスコープ外 |
| 削除方式 | 物理削除 | 論理削除は削除済みデータのフィルタリングが全クエリに必要になり複雑化する |
| 共有方式 | リンク共有（UUIDトークン） | 招待制よりシンプル。`share_token`カラム1本で実装可能 |
| エラーハンドリング | 集約エラーハンドラ + エラーコード定数 | `shared/constants.js`でフロント・サーバー共通のエラーコードを管理 |

---

## 3. データモデル設計

### ER図（概要）

```
users
  id, username, password_hash, created_at

folders
  id, user_id(FK), parent_id(FK self), name, created_at
  ※ 階層は最大3段まで（アプリ側で制御）

notes
  id, user_id(FK), folder_id(FK nullable), title, content,
  share_token(nullable・UUID), created_at, updated_at

note_tags
  note_id(FK), tag_id(FK)  ※ 中間テーブル

tags
  id, user_id(FK), name, created_at
```

### テーブル定義（制約込み）

#### users

| カラム | 型 | 制約 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| username | TEXT | NOT NULL, UNIQUE, 3〜20文字, 英数字+アンダースコアのみ |
| password_hash | TEXT | NOT NULL（bcryptハッシュ） |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

#### folders

| カラム | 型 | 制約 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → users.id, ON DELETE CASCADE |
| parent_id | INTEGER | NULLABLE, FK → folders.id（NULLはルート） |
| name | TEXT | NOT NULL, 1〜50文字 |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

> **NOTE:** 階層の深さ制限（最大3段）はアプリ側（Presenterのバリデーション）で制御する。DBの制約では表現できないため。

#### notes

| カラム | 型 | 制約 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → users.id, ON DELETE CASCADE |
| folder_id | INTEGER | NULLABLE, FK → folders.id, ON DELETE SET NULL |
| title | TEXT | NOT NULL, 1〜100文字 |
| content | TEXT | NOT NULL DEFAULT '', 最大50,000文字 |
| share_token | TEXT | NULLABLE, UNIQUE（共有リンク用UUID） |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

#### tags

| カラム | 型 | 制約 |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → users.id, ON DELETE CASCADE |
| name | TEXT | NOT NULL, 1〜20文字 |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| - | - | UNIQUE(user_id, name)（同一ユーザーで重複不可） |

#### note_tags（中間テーブル）

| カラム | 型 | 制約 |
|---|---|---|
| note_id | INTEGER | NOT NULL, FK → notes.id, ON DELETE CASCADE |
| tag_id | INTEGER | NOT NULL, FK → tags.id, ON DELETE CASCADE |
| - | - | PRIMARY KEY(note_id, tag_id) |

> **NOTE:** 1メモあたりのタグ上限10個はアプリ側（Presenter）で制御する。

### `updated_at`自動更新トリガー

SQLiteは`ON UPDATE CURRENT_TIMESTAMP`が存在しないため、トリガーで対処する（`001_init.sql`に含める）。

```sql
CREATE TRIGGER notes_updated_at
AFTER UPDATE ON notes
FOR EACH ROW
BEGIN
  UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
```

### フィールドバリデーション一覧

| フィールド | ルール | 適用場所 |
|---|---|---|
| ユーザー名 | 3〜20文字・`/^[a-zA-Z0-9_]+$/` | Presenter + DB(CHECK制約) |
| パスワード | 8文字以上・英字+数字の混在 | Presenterのみ（DBにはハッシュを保存） |
| メモタイトル | 1〜100文字 | Presenter + DB(CHECK制約) |
| メモ本文 | 最大50,000文字 | Presenter + DB(CHECK制約) |
| タグ名 | 1〜20文字 | Presenter + DB(CHECK制約) |
| タグ数 | 1メモあたり最大10個 | Presenterのみ |
| フォルダ名 | 1〜50文字 | Presenter + DB(CHECK制約) |
| フォルダ階層 | 最大3段 | Presenterのみ |

---

## 4. API インターフェース設計

### レスポンス形式（エンベロープ形式）

**成功時**
```json
{
  "success": true,
  "data": { ... }
}
```

**失敗時**
```json
{
  "success": false,
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "指定されたメモが見つかりません"
  }
}
```

### エラーコード一覧（shared/constants.js で管理）

| コード | HTTPステータス | 意味 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 入力バリデーション失敗 |
| `UNAUTHORIZED` | 401 | 認証トークンなし・無効 |
| `FORBIDDEN` | 403 | 権限なし（他人のリソース） |
| `NOTE_NOT_FOUND` | 404 | メモが存在しない |
| `FOLDER_NOT_FOUND` | 404 | フォルダが存在しない |
| `TAG_NOT_FOUND` | 404 | タグが存在しない |
| `USERNAME_TAKEN` | 409 | ユーザー名が既に使われている |
| `TAG_LIMIT_EXCEEDED` | 422 | タグ上限（10個）超過 |
| `FOLDER_DEPTH_EXCEEDED` | 422 | フォルダ階層（3段）超過 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

### エンドポイント一覧

#### 認証
| メソッド | パス | 説明 |
|---|---|---|
| POST | `/api/auth/register` | ユーザー登録 |
| POST | `/api/auth/login` | ログイン・JWT発行 |

#### メモ
| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/api/notes` | 必須 | 自分のメモ一覧（タグ・フォルダ情報含む）。更新日時降順・上限100件 |
| POST | `/api/notes` | 必須 | メモ作成 |
| GET | `/api/notes/:id` | 必須 | メモ単体取得 |
| PUT | `/api/notes/:id` | 必須 | メモ更新（タイトル・本文・フォルダ） |
| DELETE | `/api/notes/:id` | 必須 | メモ削除（物理削除） |

#### フォルダ
| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/api/folders` | 必須 | フォルダ一覧（ツリー構造） |
| POST | `/api/folders` | 必須 | フォルダ作成 |
| PUT | `/api/folders/:id` | 必須 | フォルダ名変更・移動 |
| DELETE | `/api/folders/:id` | 必須 | フォルダ削除（配下サブフォルダはCASCADE削除・配下メモはfolder_id=NULLに） |

#### タグ
| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/api/tags` | 必須 | タグ一覧 |
| POST | `/api/tags` | 必須 | タグ作成 |
| DELETE | `/api/tags/:id` | 必須 | タグ削除（中間テーブルもCASCADE） |
| POST | `/api/notes/:id/tags` | 必須 | メモにタグ付与 |
| DELETE | `/api/notes/:id/tags/:tagId` | 必須 | メモからタグ除去 |

#### 共有
| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| POST | `/api/notes/:id/share` | 必須 | 共有リンク発行（share_token生成） |
| DELETE | `/api/notes/:id/share` | 必須 | 共有リンク無効化（share_token=NULL） |
| GET | `/api/share/:token` | 不要 | 共有リンクでメモを読み取り専用で取得 |

### WebSocketイベント設計

**接続URL:** `ws://localhost:3000/ws`（認証はメッセージで行うためURLにJWTを含めない）

**接続フロー**

```
1. クライアントがWebSocket接続を開始
2. クライアントが即座に AUTH イベントを送信 { token, noteId }
3. サーバーがJWT検証
     成功 → AUTH_ACK を返し、以降のイベントを処理
     失敗 → ERROR { code: 'UNAUTHORIZED' } を返し接続クローズ
4. 認証済み状態で NOTE_SAVE / HEARTBEAT を送受信
```

> **NOTE:** クエリパラメータにJWTを乗せるとURLがサーバーログに残りセキュリティリスクになるため、メッセージ認証方式を採用する。

**クライアント → サーバー**

| イベント名 | ペイロード | タイミング |
|---|---|---|
| `AUTH` | `{ token, noteId }` | 接続直後・最初に必ず送る |
| `NOTE_SAVE` | `{ noteId, title, content, updatedAt }` | Ctrl+S保存時 |
| `HEARTBEAT` | なし | 30秒ごと |

**サーバー → クライアント**

| イベント名 | ペイロード | 意味 |
|---|---|---|
| `AUTH_ACK` | なし | 認証成功・以降の通信を許可 |
| `NOTE_UPDATED` | `{ noteId, title, content, updatedAt, updatedBy }` | 他ユーザーが保存した（送信者自身には送らない） |
| `HEARTBEAT_ACK` | なし | ハートビート応答 |
| `ERROR` | `{ code, message }` | エラー通知 |

> **NOTE（送信者除外）:** `NOTE_UPDATED`はサーバー側で「送信者を除いた同一noteIdの全接続」に配信する。クライアント側での自己送信判定は不要。
>
> **NOTE（後勝ち競合解決）:** `NOTE_UPDATED`受信時は`updatedAt`を比較し、受信データの方が新しければローカルの内容を上書きする。同時編集中の警告UIはPhase4のDoDに含める。

---

## 5. 画面設計・遷移図

### 画面一覧

| 画面ID | パス | 概要 | 認証要否 |
|---|---|---|---|
| S01 | `/login` | ログイン画面 | 不要 |
| S02 | `/register` | 新規登録画面 | 不要 |
| S03 | `/` | メモ一覧画面（フォルダ・タグ表示含む） | 必須 |
| S04 | `/notes/:id` | メモ編集画面 | 必須（共有時は読み取り専用） |
| S05 | `/share/:token` | 共有メモ閲覧画面（読み取り専用） | 不要 |

### 画面遷移図

```
[未認証]
  ├─ /login  (S01)
  │    ├─ ログイン成功 ──────────────→ / (S03)
  │    └─ 新規登録リンク ────────────→ /register (S02)
  │
  └─ /register (S02)
       ├─ 登録成功 ────────────────→ /login (S01)
       └─ ログインリンク ────────────→ /login (S01)

[認証済み]
  └─ / (S03) メモ一覧
       ├─ メモ選択 ─────────────────→ /notes/:id (S04)
       ├─ 新規メモ作成 ─────────────→ /notes/:id (S04) ※作成直後に遷移
       └─ ログアウト ────────────────→ /login (S01)

  └─ /notes/:id (S04) メモ編集
       ├─ 一覧へ戻る ───────────────→ / (S03)
       └─ 共有リンクコピー（発行済み時）

[未認証・共有リンク]
  └─ /share/:token (S05) 読み取り専用閲覧
       └─ ログインリンク ────────────→ /login (S01)

[ガード処理]
  - 未認証で S03/S04 にアクセス → /login にリダイレクト
  - 認証済みで S01/S02 にアクセス → / にリダイレクト
  - 存在しないパスへアクセス → / にリダイレクト（404画面は設けない）
```

### 各画面のUI要素

#### S01 ログイン
- ユーザー名入力・パスワード入力・ログインボタン
- エラーメッセージ表示エリア
- 新規登録へのリンク

#### S02 新規登録
- ユーザー名入力・パスワード入力・登録ボタン
- バリデーションエラー表示（ユーザー名重複含む）
- ログインへのリンク

#### S03 メモ一覧
- 左ペイン: フォルダツリー・タグ一覧・新規メモ作成ボタン
- 右ペイン: 選択中フォルダ/タグのメモ一覧（タイトル・更新日時）
- ログアウトボタン
- **初期表示（何も選択していない状態）:** 全メモを更新日時降順で表示する

#### S04 メモ編集
- タイトル入力・本文テキストエリア
- フォルダ選択プルダウン・タグ付与UI
- 保存ボタン（Ctrl+S）・共有リンクボタン
- リアルタイム同期中インジケーター（他ユーザーが編集中の場合）
- 一覧へ戻るリンク

#### S05 共有メモ閲覧
- タイトル・本文（読み取り専用）
- 「このアプリでメモを作る」→ ログインリンク

---

## 6. プロジェクト固有の制約

### 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| 変数・関数 | camelCase | `fetchNoteById`, `isLoading` |
| クラス | PascalCase | `NoteEditorView`, `NoteEditorPresenter` |
| 定数 | UPPER_SNAKE_CASE | `MAX_NOTE_LENGTH`, `WS_EVENTS` |
| ファイル名（View/Presenter/Model） | `{対象}{役割}.js` | `noteEditorView.js`, `noteEditorPresenter.js` |
| DBカラム | snake_case | `created_at`, `user_id` |
| CSSクラス | kebab-case | `note-editor`, `auth-form` |
| WebSocketイベント名 | UPPER_SNAKE_CASE | `NOTE_SAVE`, `NOTE_UPDATED` |

### コーディング規約

```
- インデント: スペース2つ
- セミコロン: あり
- クォート: シングルクォート統一
- 行末カンマ: あり（trailing comma）
- 最大行長: 100文字
- 変数宣言: const優先、再代入が必要な場合のみlet。varは禁止
- 非同期処理: async/await統一。Promiseチェーン(.then)は禁止
- import: ESMのimport/export統一。require()は禁止
- MVPの責務: Viewにロジックを書かない・PresenterにDOM操作を書かない（レビューチェック項目）
```

### コメントルール

```js
// 【単行コメント】処理の意図を書く（何をするかではなく、なぜするか）
// ❌ 悪い例: ユーザーを取得する
// ✅ 良い例: 削除済みユーザーが残留しないよう、取得前にアクティブフラグを確認する

/**
 * 【JSDoc】公開関数・クラス・モジュールには必須
 * @param {string} id - メモID
 * @returns {Promise<Note>} 取得したメモオブジェクト
 * @throws {NotFoundError} 該当メモが存在しない場合
 * @phase 3
 * @task note-fetch
 */

// TODO: 後で対応する内容（チケット番号があれば記載）
// FIXME: 既知のバグ・問題点
// NOTE: 仕様上の注意点・背景知識（後任者が迷う箇所に記載）
```

**JSDocカスタムタグ（設計書との連動）**

| タグ | 意味 | 例 |
|---|---|---|
| `@phase` | 実装フェーズ番号 | `@phase 3` |
| `@task` | タスクID（Phase定義のタスク名） | `@task note-fetch` |

### 禁止事項

| 禁止 | 代替 |
|---|---|
| `var` | `const` / `let` |
| `require()` | `import` |
| `.then()` チェーン | `async/await` |
| `eval()` | 使用禁止（代替なし） |
| `document.write()` | DOM API（`createElement`等） |
| `innerHTML`への未サニタイズ文字列代入 | `textContent` または `sanitize.js`経由 |
| ViewへのPresenterロジック混入 | Presenterに移動する |
| PresenterへのDOM操作混入 | Viewに移動する |
| `console.log`の本番コミット | 開発中のみ使用。CIでwarning検出 |

---

## 7. Phase定義と各PhaseのDoD

### ロードマップ網羅の方針

各Phaseは「機能単位」で区切り、Phaseごとにデバッグ可能な状態で完了とする。
各Phaseのロードマップ対応トピックを明記し、実装後に網羅率を更新する。

---

### Phase 1: プロジェクト基盤構築

**機能:** 開発環境・サーバー起動・DB初期化・ESLint・Vitest導入

**対応ロードマップトピック**
- ESM Modules (import/export)
- Variable Declarations (const/let)
- Node.js環境・モジュールシステム

**DoD（完了の定義）**
- [ ] Node.js 24.16.0でサーバーが`node server/index.js`で起動する
- [ ] `http://localhost:5173`でVite開発サーバーが起動し、Hello worldが表示される
- [ ] SQLiteファイル`data/app.db`が初回起動時に自動生成される（001_init.sqlが実行される）
- [ ] `npm run lint`がエラー0で完了する
- [ ] `npm run test`がテスト0件・失敗0件で完了する
- [ ] ESLint flat configが適用され、`var`使用時にエラーが出る

---

### Phase 2: 認証機能（S01・S02画面）

**機能:** ユーザー登録・ログイン・ログアウト・JWT発行と検証

**対応ロードマップトピック**
- Fetch API
- Promises / async/await
- Error Objects / try/catch/finally
- Closures（JWTトークンのメモリ保持）
- Classes（AuthView・AuthPresenter・authModel）
- DOM APIs（フォーム操作）
- Strict Mode

**DoD（完了の定義）**
- [ ] `POST /api/auth/register`でユーザー登録が完了し、JWTが返る
- [ ] `POST /api/auth/login`でログインが完了し、JWTが返る
- [ ] JWTをメモリ上のstoreに保持し、後続リクエストのAuthorizationヘッダに付与する
- [ ] 不正トークンで保護ルートにアクセスすると`UNAUTHORIZED`エラーが返る
- [ ] ログアウト後にJWTが破棄され、保護ルートにアクセスできなくなる
- [ ] S01・S02画面が表示され、画面遷移が動作する
- [ ] AuthViewにPresenterのロジックが混入していない（レビュー確認）
- [ ] Vitestで認証関連の単体テストが3件以上通過する

---

### Phase 3: メモ・フォルダ・タグCRUD（S03・S04画面）

**機能:** メモ/フォルダ/タグの作成・取得・更新・削除、画面表示

**対応ロードマップトピック**
- Fetch API（GET/POST/PUT/DELETE全メソッド）
- JSON（シリアライズ・デシリアライズ）
- Map / Set（クライアント側キャッシュ管理）
- Iterators（一覧のイテレーション）
- Recursion（フォルダツリーの再帰描画）
- Classes（各View・Presenter・Model）
- DOM APIs（リスト描画・動的更新）
- this / call / apply / bind（イベントバインディング）
- Symbol（イテレータプロトコル実装）

**DoD（完了の定義）**
- [ ] メモのCRUDが全エンドポイントで動作する
- [ ] フォルダのCRUDが全エンドポイントで動作する
- [ ] タグのCRUDが全エンドポイントで動作する
- [ ] メモへのタグ付与・除去が動作する
- [ ] S03画面でフォルダツリー・タグ一覧・メモ一覧が表示される
- [ ] S04画面でメモの編集・保存（Ctrl+S）・フォルダ変更・タグ操作ができる
- [ ] フォルダ階層3段超過時に`FOLDER_DEPTH_EXCEEDED`エラーが表示される
- [ ] タグ10個超過時に`TAG_LIMIT_EXCEEDED`エラーが表示される
- [ ] 各View・Presenter・Modelの責務が分離されている（レビュー確認）
- [ ] Vitestで各層の単体テストが通過する

---

### Phase 4: 共有機能・リアルタイム同期（WebSocket）

**機能:** 共有リンク発行・共有メモ閲覧・複数クライアント間のリアルタイム同期

**対応ロードマップトピック**
- Event Loop（WebSocketイベントの非同期処理）
- Generators（差分生成のイテレーション）
- Callbacks（WebSocketイベントハンドラ）
- WeakMap / WeakSet（WebSocket接続オブジェクト管理）
- Memory Management（接続の適切なクローズ・GC）
- setTimeout / setInterval（ハートビート・自動再接続）
**DoD（完了の定義）**
- [ ] `POST /api/notes/:id/share`で共有トークンが生成される
- [ ] `/share/:token`（S05画面）で読み取り専用表示ができる
- [ ] 共有リンク無効化（DELETE）が動作する
- [ ] タブAでCtrl+S保存するとタブBにリアルタイムで反映される
- [ ] 他ユーザーが編集中の場合、S04画面に同期インジケーターが表示される
- [ ] 接続断時に自動再接続（最大3回・指数バックオフ）が動作する
- [ ] サーバー側でWeakMapを使いWebSocket接続を管理している
- [ ] 30秒間隔のハートビートが実装されている
- [ ] 後勝ちの競合解決（updatedAt比較）が実装されている
- [ ] Vitestで差分生成・競合解決ロジックの単体テストが通過する

---

### Phase 5: デバッグ・最適化・仕上げ

**機能:** パフォーマンス改善・メモリリーク検証・DevTools活用・全体品質担保

**対応ロードマップトピック**
- Debugging Issues（Chrome DevTools）
- Debugging Memory Leaks（HeapスナップショットによるWeakMap検証）
- Debugging Performance（Performanceタブでのボトルネック特定）
- Garbage Collection（不要な参照の除去確認）
- Memory Lifecycle（Allocation → Use → Release の追跡）

**DoD（完了の定義）**
- [ ] Chrome DevToolsのMemoryタブでヒープスナップショットを取得し、明らかなリークがないことを確認する
- [ ] Performanceタブで初回描画（FCP）が2秒以内であることを確認する
- [ ] `npm run lint`がエラー・警告0で完了する
- [ ] `npm run test`の全テストが通過する
- [ ] `npm run build`（Viteビルド）がエラーなく完了する
- [ ] CIが全ジョブグリーンで完了する
- [ ] 各Phase完了時に更新履歴（セクション9）に記録されている

---

### 最終網羅率（目標）

> ロードマップの正確な総トピック数は **76項目**（PDFから再集計）。以前の53という数字は誤り。

| カテゴリ | 総数 | カバー | 言及のみ | 未カバー | 網羅率 |
|---|---|---|---|---|---|
| Introduction to JavaScript | 4 | 2 | 2 | 0 | 50% |
| All about Variables | 6 | 6 | 0 | 0 | 100% |
| Data Types | 9 | 8 | 1 | 0 | 89% |
| Type Casting | 3 | 3 | 0 | 0 | 100% |
| Data Structures | 7 | 6 | 0 | 1 | 86% |
| Equality Comparisons | 4 | 4 | 0 | 0 | 100% |
| Loops and Iterations | 6 | 6 | 0 | 0 | 100% |
| Control Flow | 5 | 5 | 0 | 0 | 100% |
| Expressions & Operators | 10 | 7 | 1 | 2 | 70% |
| Functions | 9 | 9 | 0 | 0 | 100% |
| Asynchronous JavaScript | 7 | 6 | 1 | 0 | 86% |
| Working with APIs | 2 | 1 | 1 | 0 | 50% |
| Modules in JavaScript | 2 | 1 | 1 | 0 | 50% |
| Iterators and Generators | 2 | 2 | 0 | 0 | 100% |
| Classes | 1 | 1 | 0 | 0 | 100% |
| Memory Management | 2 | 2 | 0 | 0 | 100% |
| Using Browser DevTools | 3 | 3 | 0 | 0 | 100% |
| **合計** | **76** | **72** | **7** | **3** | **89%** |

**言及のみ（NOTEコメントで解説）7件**
History of JS / JS Versions / XMLHttpRequest / CommonJS / BigInt Operators / Comma Operators / Callback Hell

**未カバー 3件（意図的に除外）**

| トピック | 除外理由 |
|---|---|
| Typed Arrays | バイナリ処理はメモアプリの要件に存在しない。無理な組み込みはコードの意図を損なう |
| Bitwise Operators | ビット演算はアプリ要件に合わない。学習目的のコードになるため除外 |
| Unary Operators | 同上 |

---

## 8. 検証の仕組み

### テスト方針

| テスト種別 | ツール | 対象 | 場所 |
|---|---|---|---|
| 単体テスト | Vitest | Presenter・Modelのロジック（DOM不要な部分） | `tests/unit/` |
| 結合テスト | Vitest + supertest | APIエンドポイント | `tests/integration/` |
| 静的解析 | ESLint 9 (flat config) | 全JSファイル | CI・ローカル |

> **NOTE:** ViewはDOM依存のためVitestでのテストは最小限とし、Presenterのテストで品質を担保する。これがMVPを採用した主な理由のひとつ。

### CIジョブ定義（GitHub Actions）

```yaml
# トリガー: main・developへのpush、全ブランチへのPR
jobs:
  lint:    # ESLintで全ファイルをチェック
  test:    # Vitestで全テストを実行（lint通過後）
  build:   # Viteでフロントエンドのビルド確認（test通過後）
```

### npm scripts

```json
{
  "scripts": {
    "dev": "concurrently で vite と node server/index.js を同時起動",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

---

## 9. Claudeへの指示テンプレート（コンテキストパケット）

> このテンプレートを各実装セッションの先頭に貼り付けてClaudeに渡す。

```
## 固定情報（プロジェクト全体を通じて変わらない）
- アプリ: リアルタイム共同メモアプリ (SPA + Node.js + WebSocket + SQLite)
- Node.js: 24.16.0 / Vite: 6.x / Express: 5.x / ws: 8.x / better-sqlite3: 9.x
- 言語: Vanilla JS (ES2022+, ESM) / TypeScript不使用
- アーキテクチャ: MVPパターン（View=DOM操作のみ / Presenter=ロジック / Model=APIアクセス）
- テスト: Vitest / Lint: ESLint 9 flat config
- コメント: 日本語 / JSDocにカスタムタグ @phase @task を使用
- 設計書: docs/DESIGN.md（ディレクトリ構成・命名規則・DB設計・API設計・禁止事項を参照）

## 変動情報（セッションごとに更新する）
- 現在のPhase: Phase X
- 今回実装するタスク: （例: Phase3 - メモ一覧API + NoteListView/Presenter/Model）
- 前回までの完了状態: （例: Phase2完了。認証・JWT・S01/S02画面が動作している）
- 現在のエラー・問題: （あれば記載）

## 制約情報（Claudeへの禁止事項）
- varを使わない
- require()を使わない
- .then()チェーンを書かない
- ViewにPresenterのロジックを書かない
- PresenterにDOM操作を書かない
- 設計書のディレクトリ構成・DB設計・APIインターフェースを変更しない
  （変更提案はコメントでのみ行う）
- テストを省略しない（各Phaseの単体テストは必ず含める）
```

---

## 10. 更新履歴（失敗と変更理由の記録）

| 日付 | 変更内容 | 変更理由 |
|---|---|---|
| 設計確定日 | 初版作成 | 全設計項目の確定 |
| 設計確定日+1 | 網羅率を98%→89%に修正・総トピック数を53→76に修正 | PDFを正確に再カウントした結果、53という数字は根拠不明と判明。正確な総数は76項目 |
| 設計確定日+1 | 未カバー3項目（Typed Arrays / Bitwise Operators / Unary Operators）を意図的除外として明記 | メモアプリの要件に合わない。学習目的のコードは品質を損なうため組み込まない方針に |
| 設計確定日+1 | Phase 6（デザインシステム）を追加 | コラージュ風UIの実装方針を確定 |
| Phase 1完了後 | better-sqlite3のバージョンを9.x→12.xに修正 | Node.js 24.16.0環境ではネイティブモジュールのコンパイルエラーが発生したため最新版（12.x）を採用。設計書の記載が実態と乖離していたため修正 |
| Phase 1完了後 | セクション2にFlutterのMVVMとの対応表・説明を追加 | Flutter（MVVM）経験者がMVPパターンとブラウザ/サーバー/DB層の関係を正しく理解するための補足。Model層がブラウザ内に存在する理由・サーバー層との違いを明記 |
| Phase 1完了後 | セクション12にPhase 1で作成したファイル一覧と役割を追加 | 各ファイルが何をしているかをPhase 2開始前に整理。画面表示の仕組み・サーバーの正体・DBの正体のNOTEも追記 |

> 変更時の記載ルール:
> - 「何を変えたか」だけでなく「なぜ変えたか・何が問題だったか」を必ず記録する
> - うまくいかなかった試みも削除せず、~~打ち消し線~~で残す

---

## 11. デザインシステム（Phase 6）

> Phase 1〜5の実装完了後に着手する。機能には手を加えず、UIの見た目のみを変更する。

### デザインコンセプト

「モダン × アナログコラージュ」。デジタルなメモアプリに手刷り・切り抜きの質感を組み合わせたスタイル。

### カラーパレット

| 役割 | 色名 | HEX |
|---|---|---|
| プライマリ | テール（深緑） | `#0F6E56` |
| アクセント | バーントオレンジ | `#C8440A` |
| 背景ベース | オフホワイト | `#F5F1EB` |
| テキスト | チャコール | `#1E1E1E` |
| サーフェス | ライトペーパー | `#EDE8DF` |

### デザイン要素

- 背景：オフホワイトベースに破れた紙風のテクスチャをCSS（`clip-path` + `border-radius`の不規則値）で再現
- 幾何学アクセント：三角形・ライン・矩形をCSSの`::before` / `::after`でランダム配置
- カード：わずかな傾き（`rotate: -0.5deg〜1deg`）をランダムに付与してコラージュ感を演出
- フォント：見出しにセリフ系（Google Fonts: `Playfair Display`）、本文にサンセリフ（`Inter`）
- ボタン・バッジ：角丸を抑えた四角に近いシェイプ（`border-radius: 2px`）

### Phase 6 DoD

- [ ] カラーパレットをCSS Custom Propertiesで定義し、全画面に適用する
- [ ] 背景・カードのコラージュテクスチャが5画面すべてに適用されている
- [ ] 幾何学アクセント（三角形・ライン）がレイアウトを崩さず装飾されている
- [ ] フォントが適用され、既存のレイアウトが崩れていない
- [ ] `npm run lint` / `npm run test` / `npm run build` が引き続きグリーンで完了する
- [ ] Chrome DevToolsのPerformanceタブでFCPが2秒以内を維持している

---

## 12. Phase 1 実装手順（初回セットアップガイド）

> JavaScriptプロジェクトの作成・リポジトリ構築が初めての場合はこの手順に従う。

### 事前準備チェックリスト

```bash
node -v        # 24.16.0 であること（異なる場合はアップグレード）
npm -v         # 10.x 以上であること
git --version  # インストール済みであること
```

### Node.js アップグレード手順（現在24.3.0の場合）

```bash
# macOSの場合
brew install node@24   # または公式サイト https://nodejs.org からLTSをダウンロード

# Windowsの場合
# 公式サイト https://nodejs.org からLTS版インストーラをダウンロードして実行
```

### GitHubリポジトリ作成手順

1. https://github.com/new にアクセス
2. Repository name: `realtime-memo-app`
3. Private を選択
4. `Add a README file` にチェック
5. `Create repository` をクリック
6. `Code` ボタン → HTTPSのURLをコピー

```bash
git clone <コピーしたURL>
cd realtime-memo-app
```

---

### Phase 1 で作成したファイルと役割

#### 設定ファイル（プロジェクトのルール定義）

| ファイル | 役割 | Flutterで例えると |
|---|---|---|
| `package.json` | プロジェクトの設定・使用するパッケージ一覧・npm scriptsの定義 | `pubspec.yaml` |
| `eslint.config.js` | コードのルール定義（varを使わない・インデント2つ等） | `analysis_options.yaml` |
| `.gitignore` | Gitに含めないファイルの定義（node_modules・data/等） | `.gitignore` そのまま |

#### クライアント（ブラウザ層）

| ファイル | 役割 |
|---|---|
| `client/index.html` | ブラウザが最初に読み込むファイル。`<div id="app">` という空の箱と `main.js` の読み込みだけを書いている |
| `client/vite.config.js` | Viteの設定。ポート番号・`/api` と `/ws` をExpressに転送するプロキシの設定 |
| `client/src/main.js` | JSのエントリーポイント。Phase 1では「Hello World」を表示するだけ。Phase 2以降でログイン画面等に置き換える |

> **NOTE（画面表示の仕組み）:** ブラウザが `localhost:5173` にアクセスすると、ViteがHTMLファイルを返す。
> HTMLの中の `<script src="/src/main.js">` によりJSが読み込まれ、
> `document.getElementById('app')` で空の箱を取得してその中に内容を書き込む。
> `document` はブラウザが自動で用意するグローバル変数であり、自分で定義する必要はない。

#### サーバー層

| ファイル | 役割 |
|---|---|
| `server/index.js` | サーバーの起動ファイル。`node server/index.js` で実行する起点 |
| `server/app.js` | Expressの設定ファイル。ミドルウェアとルーティングをここで組み立てる。起動処理（listen）は `index.js` に分けている |

> **NOTE（サーバーの正体）:** 専用のサーバー機器は不要。`node server/index.js` を実行した瞬間に
> 自分のMac自体がサーバーになり `localhost:3000` でリクエストを待ち受け始める。

#### DB層

| ファイル | 役割 |
|---|---|
| `server/db/connection.js` | DBへの接続・初期化を担当。サーバー起動時に `data/app.db` を自動生成してマイグレーションSQLを実行する |
| `server/db/migrations/001_init.sql` | テーブル定義のSQL。users・notes・folders・tags・note_tagsの5テーブルを定義している |

> **NOTE（DBの正体）:** `data/app.db` という1ファイルがDB全体。Flutterのsqfliteと同じ仕組み。
> ブラウザはこのファイルの存在を知らず、必ずサーバーを経由してアクセスする。

#### 共通・テスト

| ファイル | 役割 |
|---|---|
| `shared/constants.js` | ブラウザとサーバーの両方から使う定数をまとめたファイル。エラーコード・WebSocketイベント名・バリデーション上限値を管理 |
| `tests/unit/constants.test.js` | `shared/constants.js` の値が設計書通りかを確認するテスト。Vitestが正しく動くことの確認も兼ねている |

#### Phase 2以降で追加するファイル

| ファイル | 追加するPhase | 内容 |
|---|---|---|
| `client/src/router.js` | Phase 2 | 画面遷移の管理 |
| `client/src/views/` | Phase 2〜 | 各画面のDOM操作 |
| `client/src/presenters/` | Phase 2〜 | 各画面のロジック |
| `client/src/models/` | Phase 2〜 | APIコール |
| `server/routes/` | Phase 2〜 | 認証・メモ等のAPIエンドポイント |
| `server/middleware/` | Phase 2〜 | JWT認証チェック |
| `server/ws/handler.js` | Phase 4 | WebSocketのリアルタイム処理 |

