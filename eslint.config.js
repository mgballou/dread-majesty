import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },

  {
    // Config files are loaded by their tools through a default export.
    files: ['**/*.config.{js,ts}', 'eslint.config.js'],
    rules: { 'no-restricted-exports': 'off' },
  },

  {
    // CLAUDE.md, the engine's five rules. Rule 1: no ambient time, no randomness,
    // no I/O. Time and seeds enter as arguments at the boundary.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message: 'The engine takes time as an argument. See CLAUDE.md, engine rule 1.',
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'The engine takes time as an argument. See CLAUDE.md, engine rule 1.',
        },
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'The engine takes seeds as arguments. See CLAUDE.md, engine rule 1.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@dm/content',
              importNames: ['v1', 'CURRENT'],
              message:
                'The engine takes content as an argument. Types and ids only. See CLAUDE.md.',
            },
          ],
        },
      ],
    },
  },

  {
    // Engine tests run against fixtures so a balance change cannot fail them.
    files: ['packages/engine/test/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@dm/content',
              importNames: ['v1', 'CURRENT'],
              message: 'Engine tests use test/fixtures/content.ts. See CLAUDE.md, Testing.',
            },
          ],
        },
      ],
    },
  },
);
