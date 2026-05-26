/**
 * フロントエンド・サーバー共通の定数。
 * エラーコードとWebSocketイベント名はここで一元管理する。
 * @phase 1
 * @task project-init
 */

/** APIエラーコード */
export const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOTE_NOT_FOUND: 'NOTE_NOT_FOUND',
    FOLDER_NOT_FOUND: 'FOLDER_NOT_FOUND',
    TAG_NOT_FOUND: 'TAG_NOT_FOUND',
    USERNAME_TAKEN: 'USERNAME_TAKEN',
    TAG_LIMIT_EXCEEDED: 'TAG_LIMIT_EXCEEDED',
    FOLDER_DEPTH_EXCEEDED: 'FOLDER_DEPTH_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
};

/** WebSocketイベント名 */
export const WS_EVENTS = {
    // クライアント → サーバー
    AUTH: 'AUTH',
    NOTE_SAVE: 'NOTE_SAVE',
    HEARTBEAT: 'HEARTBEAT',
    // サーバー → クライアント
    AUTH_ACK: 'AUTH_ACK',
    NOTE_UPDATED: 'NOTE_UPDATED',
    HEARTBEAT_ACK: 'HEARTBEAT_ACK',
    ERROR: 'ERROR',
};

/** バリデーション定数 */
export const LIMITS = {
    USERNAME_MIN: 3,
    USERNAME_MAX: 20,
    PASSWORD_MIN: 8,
    NOTE_TITLE_MAX: 100,
    NOTE_CONTENT_MAX: 50000,
    TAG_NAME_MAX: 20,
    TAGS_PER_NOTE: 10,
    FOLDER_NAME_MAX: 50,
    FOLDER_DEPTH_MAX: 3,
    NOTES_PER_PAGE: 100,
};