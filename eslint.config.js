import js from '@eslint/js'
import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'
import refresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'src/Example.*'] },
  { files: ['**/*.{js,jsx}'], languageOptions: { ecmaVersion: 2022, globals: globals.browser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } }, plugins: { 'react-hooks': hooks, 'react-refresh': refresh }, rules: { ...js.configs.recommended.rules, ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': 'off', 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['vite.config.js'], languageOptions: { globals: globals.node } }
]
