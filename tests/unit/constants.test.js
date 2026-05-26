/**
 * Phase 1 動作確認テスト。
 * Vitestが正しく動作することと、shared/constants.jsが正しく読み込めることを確認する。
 * @phase 1
 * @task vitest-setup
 */

import { describe, it, expect } from 'vitest';
import { ERROR_CODES, WS_EVENTS, LIMITS } from '../../shared/constants.js';

describe('shared/constants', () => {
    it('ERROR_CODES に必須コードが存在する', () => {
        expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
        expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
        expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('WS_EVENTS に送受信イベント名が存在する', () => {
        expect(WS_EVENTS.AUTH).toBe('AUTH');
        expect(WS_EVENTS.NOTE_SAVE).toBe('NOTE_SAVE');
        expect(WS_EVENTS.NOTE_UPDATED).toBe('NOTE_UPDATED');
    });

    it('LIMITS の値が設計書の定義と一致する', () => {
        expect(LIMITS.USERNAME_MIN).toBe(3);
        expect(LIMITS.USERNAME_MAX).toBe(20);
        expect(LIMITS.NOTE_CONTENT_MAX).toBe(50000);
        expect(LIMITS.TAGS_PER_NOTE).toBe(10);
        expect(LIMITS.FOLDER_DEPTH_MAX).toBe(3);
    });
});