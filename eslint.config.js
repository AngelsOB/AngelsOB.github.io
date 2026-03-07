import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['.next', 'dist', '.vite', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
    ],
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow unused vars prefixed with _ (common destructuring pattern)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // Allow explicit any — too noisy to enforce on existing codebase
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow @ts-ignore with description
      '@typescript-eslint/ban-ts-comment': 'warn',

      // Accessibility rules - spread recommended, then override specific ones
      ...jsxA11y.configs.recommended.rules,
      // Configure label rule to recognize our custom input components as form controls
      'jsx-a11y/label-has-associated-control': [
        'warn',
        {
          controlComponents: [
            'InputWithSuffix',
            'DualUnitInput',
            'InlineEditableNumber',
            'AutoWidthUnitSelect',
            'NotesTextarea',
            'SearchSelect',
          ],
          depth: 3,
        },
      ],
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      // autoFocus can be appropriate in modals for UX; warn rather than error
      'jsx-a11y/no-autofocus': 'warn',

      // Enforce strict equality
      'eqeqeq': ['error', 'always', { null: 'ignore' }],

      // Disallow console statements (allow console.error in catch blocks for error logging)
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
])
