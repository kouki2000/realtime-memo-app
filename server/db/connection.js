/**
 * SQLiteデータベースへの接続と初期化を担当する。
 * better-sqlite3は同期APIのため、このモジュール自体は同期で完結する。
 * @phase 1
 * @task db-init
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESMでは __dirname が存在しないため import.meta.url から導出する
const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = join(__dirname, '../../data/app.db');
const MIGRATION_PATH = join(__dirname, 'migrations/001_init.sql');

/**
 * DBインスタンスを初期化して返す。
 * data/app.db が存在しない場合は自動生成し、マイグレーションSQLを実行する。
 * @returns {import('better-sqlite3').Database} 初期化済みDBインスタンス
 */
const initDatabase = () => {
  const db = new Database(DB_PATH);

  // WALモードを有効化（読み書きの同時実行性が向上する）
  db.pragma('journal_mode = WAL');

  // 外部キー制約を有効化（SQLiteはデフォルト無効）
  db.pragma('foreign_keys = ON');

  // マイグレーションSQLを読み込んで実行する
  // IF NOT EXISTS で冪等性を保証しているため、起動のたびに実行しても安全
  const migration = readFileSync(MIGRATION_PATH, 'utf8');
  db.exec(migration);

  return db;
};

// シングルトンとしてエクスポートする
// Node.jsのモジュールキャッシュにより、import先で何度呼び出しても同一インスタンスになる
export const db = initDatabase();