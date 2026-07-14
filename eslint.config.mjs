import eslint from '@eslint/js';
import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'scripts/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      parser,
      parserOptions: { project: './tsconfig.json', sourceType: 'module' },
      globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', fetch: 'readonly', AbortSignal: 'readonly', AbortController: 'readonly', DOMException: 'readonly', Request: 'readonly', Response: 'readonly', Headers: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },
    },
    plugins: { '@typescript-eslint': plugin },
    rules: {
      ...plugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts', 'packages/**/*.spec.ts'],
    languageOptions: {
      globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', jest: 'readonly', afterEach: 'readonly', beforeEach: 'readonly', afterAll: 'readonly' },
    },
  },
  prettier,
];
