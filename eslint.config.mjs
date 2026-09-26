import js from './frontend/portfolio/node_modules/@eslint/js/src/index.js'
import globals from './frontend/portfolio/node_modules/globals/index.js'

export default [
  { ignores: ['tests/e2e/artifacts/**'] },
  {
    files: ['tests/e2e/**/*.mjs', 'eslint.config.mjs'],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // Playwright requires destructuring in the fixture argument, even if unused.
      'no-empty-pattern': 'off',
    },
  },
]
