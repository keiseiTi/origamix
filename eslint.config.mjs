import { serverBoundaries } from './packages/server/scripts/eslint-boundaries.mjs';
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
    rules: {
      '@typescript-eslint/no-unused-vars': [1],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration[body.type="BlockStatement"]:not([generator=true])',
          message: 'Use an arrow-function expression for standalone functions.',
        },
        {
          selector: 'VariableDeclarator > FunctionExpression:not([generator=true])',
          message: 'Use an arrow-function expression for standalone functions.',
        },
      ],
      'prefer-arrow-callback': 'error',
    },
  },
  {
    files: ['packages/server/**/*.ts'],
    plugins: { architecture: { rules: { 'server-boundaries': serverBoundaries } } },
    rules: { 'architecture/server-boundaries': 'error' },
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
          patterns: [
            'node:*',
            '@origamix/server',
            '@origamix/server/*',
            '@base-ui/react',
            '@base-ui/react/*',
          ],
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
          patterns: ['node:*', '@origamix/*'],
        },
      ],
    },
  },
  {
    files: ['packages/editor/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...builtinModules, 'electron'],
          patterns: [
            'node:*',
            '@origamix/app',
            '@origamix/app/**',
            '@origamix/materials',
            '@origamix/materials/**',
            '@origamix/server',
            '@origamix/server/**',
            '@origamix/desktop',
            '@origamix/desktop/**',
            '**/app/src/**',
            '**/materials/**',
            '**/server/**',
            '**/desktop/**',
          ],
        },
      ],
    },
  },
  {
    files: ['packages/editor/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['packages/ui/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...builtinModules, 'electron'],
          patterns: [
            'node:*',
            '@origamix/*',
            '!@origamix/ui',
            '!@origamix/ui/**',
            '**/app/src/**',
            '**/editor/src/**',
            '**/shared/src/**',
            '**/materials/**',
            '**/runtime/**',
            '**/server/**',
            '**/desktop/**',
          ],
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
    files: ['packages/runtime/**/*.{ts,tsx}'],
    ignores: ['**/*.test.*', '**/*.config.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...builtinModules, 'electron'],
          patterns: [
            'node:*',
            '@origamix/editor',
            '@origamix/editor/*',
            '@origamix/materials',
            '@origamix/materials/*',
            '@origamix/app',
            '@origamix/app/*',
            '@origamix/server',
            '@origamix/server/*',
            '@origamix/desktop',
            '@origamix/desktop/*',
          ],
        },
      ],
    },
  },
  {
    files: ['apps/desktop/src/**/*.ts', 'packages/server/**/*.ts', 'packages/app/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.config.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { project: false },
    },
  },
  {
    files: ['**/*.d.ts'],
    languageOptions: { parserOptions: { project: false } },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'apps/desktop/scripts/**/*.{mjs,cjs}',
      'apps/desktop/test/**/*.{mjs,cjs}',
      'packages/server/scripts/**/*.mjs',
      'packages/server/test/**/*.mjs',
      'packages/app/scripts/**/*.mjs',
      'packages/app/test/**/*.mjs',
    ],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
