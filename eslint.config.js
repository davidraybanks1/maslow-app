import js from '@eslint/js'
import globals from 'globals'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      // The one rule that catches the bug class that already shipped:
      'no-undef': 'error',

      // React / hooks basics needed for JSX to parse cleanly:
      'react/jsx-uses-react': 'warn',
      'react/jsx-uses-vars': 'warn',
      'react-hooks/rules-of-hooks': 'warn',

      // Everything else off — no noise on an existing codebase:
      ...Object.fromEntries(
        Object.keys(js.configs.recommended.rules).map(r => [r, 'off'])
      ),
      'no-undef': 'error',
    },
  },
]
