/**
 * サーバーエントリーポイント。
 * Expressサーバーを起動する。
 * WebSocketサーバーはPhase 4で追加する。
 * @phase 1
 * @task server-init
 */

import { app } from './app.js';
// DB接続はimportするだけで初期化される（副作用としてのDB生成）
import { db } from './db/connection.js';

const PORT = process.env.PORT ?? 3000;

// サーバー起動
app.listen(PORT, () => {
  // NOTE: ここだけはconsole.logを許容する（起動確認のための出力）
  // eslint-disable-next-line no-console
  console.log(`サーバー起動: http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log('DB初期化完了: data/app.db');
});

// プロセス終了時にDBを安全にクローズする
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});