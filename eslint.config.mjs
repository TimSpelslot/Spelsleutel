import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import configPrettier from 'eslint-config-prettier'

// Single flat config for the whole monorepo. File-glob blocks scope the
// environment per workspace (browser for the frontend, Node for the backend).
// Prettier owns formatting, so eslint-config-prettier is applied last to
// switch off every formatting-related rule.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'spelslot-frontend/public/**',
      'spelslot-frontend/dev-dist/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Use the TypeScript parser inside <script lang="ts"> of .vue files.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },

  // Frontend — browser environment.
  {
    files: ['spelslot-frontend/**/*.{ts,vue}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Backend — Node environment.
  {
    files: ['spelslot-backend/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Build/config files run under Node.
  {
    files: ['**/*.config.{ts,js,mjs}', 'eslint.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Project idioms (see .claude/instructions/*.instructions.md):
  // - `_`-prefixed args/vars are intentionally unused.
  // - caught errors named but unused are fine (re-thrown via next(err) etc.).
  // - CLI scripts use `cond ? ok() : fail()` ternaries as statements.
  // - intentional empty `catch {}` (parse-and-fall-through) is allowed.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        { allowShortCircuit: true, allowTernary: true },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // TypeScript already resolves identifiers and types, so the core no-undef
  // rule only produces false positives on DOM types (e.g. NotificationPermission).
  {
    files: ['**/*.{ts,vue}'],
    rules: { 'no-undef': 'off' },
  },

  configPrettier,
)
