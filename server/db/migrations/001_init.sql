-- 外部キー制約を有効化（SQLiteはデフォルト無効のため必須）
PRAGMA foreign_keys = ON;

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE
                        CHECK(length(username) BETWEEN 3 AND 20)
                        CHECK(username GLOB '*[A-Za-z0-9_]*'),
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- フォルダテーブル（自己参照FKで階層構造を表現）
CREATE TABLE IF NOT EXISTS folders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER          REFERENCES folders(id),
  name       TEXT    NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- メモテーブル
CREATE TABLE IF NOT EXISTS notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id    INTEGER          REFERENCES folders(id) ON DELETE SET NULL,
  title        TEXT    NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  content      TEXT    NOT NULL DEFAULT ''
                       CHECK(length(content) <= 50000),
  share_token  TEXT    UNIQUE,
  created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- タグテーブル（同一ユーザーで重複不可）
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL CHECK(length(name) BETWEEN 1 AND 20),
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- メモ-タグ中間テーブル
CREATE TABLE IF NOT EXISTS note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY(note_id, tag_id)
);

-- updated_at 自動更新トリガー（SQLiteはON UPDATE CURRENT_TIMESTAMPが存在しないため）
CREATE TRIGGER IF NOT EXISTS notes_updated_at
AFTER UPDATE ON notes
FOR EACH ROW
BEGIN
  UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
