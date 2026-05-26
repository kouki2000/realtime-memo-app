import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', 'dist/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js環境のグローバル変数
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
        // ブラウザ環境のグローバル変数を追加
        document: 'readonly',
        window: 'readonly',
        history: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        WebSocket: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
      },
    },
    rules: {
      'no-var': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
];