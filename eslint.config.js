import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/ui/kit', 'src/devkit', '.claude', '.planning', 'art', 'fonts', 'public', 'scripts', 'vite-plugins/devkit', 'src/version']), // .planning holds the throwaway sketches; .claude = helpers' worktrees; src/ui/kit + src/devkit are framework copies, linted by the framework's own setup (install-module runs it)
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
