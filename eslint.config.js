import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/',
      '**/node_modules/',
      'app/public/',
      '**/test-results/',
      '**/playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['app/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // The entry file renders the app and exports nothing.
    files: ['app/src/main.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Record and sync types are shared with the Supabase tests and the tools,
    // so they import nothing from screens, the store or UI libraries (eng review D1).
    files: ['app/src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/screens/**', '**/store/**', '**/wrapped/**', '**/catalog/**'],
              message: 'model/ must not depend on app code.',
            },
            {
              group: ['react', 'react-*', 'dexie', 'dexie-*', 'wouter', '@leeoniya/*'],
              message: 'model/ must not depend on UI or storage libraries.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tools/**/*.{ts,mjs,js}', '*.config.{ts,js}', 'app/*.config.ts', 'app/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
