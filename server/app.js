/**
 * Expressアプリケーションの定義。
 * ミドルウェアとルーティングをここで組み立てる。
 * サーバー起動（listen）は index.js で行う（テスト時にポートを制御しやすくするため）。
 * @phase 1
 * @task server-init
 */

import express from 'express';

export const app = express();

// リクエストボディをJSON形式でパースするミドルウェア
// これがないと req.body が undefined になる
app.use(express.json());

// Phase 1: 動作確認用のヘルスチェックエンドポイント
// Phase 2以降で routes/ に移動する
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});