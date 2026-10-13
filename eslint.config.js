import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'docs/', 'test/fixtures/**/dist/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        performance: 'readonly',
        structuredClone: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-control-regex': 'off',
      'no-misleading-character-class': 'off',
    },
  },
);
