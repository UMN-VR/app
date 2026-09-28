import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .local/ is the YouVisit backup and scratch; public/ is generated.
  globalIgnores(['dist', '.local', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  {
    files: ['tools/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2024, globals: globals.node },
  },
])
