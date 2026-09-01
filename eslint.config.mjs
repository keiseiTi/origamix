import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { builtinModules } from 'node:module';

export default defineConfig([
  globalIgnores(['**/dist/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        project: true, // or './tsconfig.json'
        tsconfigRootDir: import.meta.dirname, // Tells ESLint to look relative to this file
      },
    },
  },
  {
    files: ['packages/app/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...builtinModules, 'electron'],
          patterns: ['node:*', '@origamix/server', '@origamix/server/*'],
        },
      ],
    },
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...builtinModules, 'electron', 'react', 'react-dom', 'fastify'],
          patterns: ['node:*', '@origamix/server/*'],
        },
      ],
    },
  },
  {
    files: ['packages/materials/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [...builtinModules, 'electron', '@origamix/app', '@origamix/server'],
          patterns: ['node:*', '@origamix/app/*', '@origamix/server/*', '@origamix/desktop/*'],
        },
      ],
    },
  },
  {
    files: ['apps/desktop/src/**/*.ts', 'packages/server/**/*.ts', 'packages/app/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.d.ts'],
    languageOptions: { parserOptions: { project: false } },
  },
  {
    files: [
      'apps/desktop/scripts/**/*.{mjs,cjs}',
      'packages/server/scripts/**/*.mjs',
      'packages/app/scripts/**/*.mjs',
    ],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
