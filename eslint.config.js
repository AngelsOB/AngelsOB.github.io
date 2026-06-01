import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tseslint from 'typescript-eslint'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  globalIgnores(['.next', 'dist', '.vite', 'node_modules', '.claude/worktrees']),
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

      // Block deprecated classic UI imports — extended per HOPSKIP_MIGRATION_PRD.md as each
      // section migrates. Phase 1.1: classic browse page + card are replaced by HS-native.
      // Files exempted with inline `// eslint-disable-next-line no-restricted-imports` are
      // transitional and tracked in the PRD's per-phase choreography.
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '**/modules/sharing/BrowseRecipesPage',
              '**/modules/sharing/BrowseCard',
            ],
            message:
              'Classic UI. Use HSBrowsePage / HSBrowseCard from @/modules/hopskip/components/public/ instead. See HOPSKIP_MIGRATION_PRD.md §1.1.',
          },
          {
            group: [
              '**/modules/sharing/PublicRecipeClient',
              '**/modules/sharing/PublicRecipeView',
              '**/modules/sharing/ForkButton',
              '**/modules/sharing/RatingStars',
            ],
            message:
              'Classic UI. Use HSPublicRecipeShell / HSForkButton / HSRatingStars from @/modules/hopskip/components/public/ instead. See HOPSKIP_MIGRATION_PRD.md §1.2.',
          },
          {
            group: [
              '**/modules/sharing/UserProfileClient',
            ],
            message:
              'Classic UI. Use HSUserProfile from @/modules/hopskip/components/public/ instead. See HOPSKIP_MIGRATION_PRD.md §1.4.',
          },
          {
            group: [
              '**/modules/compare/CompareRecipesPage',
            ],
            message:
              'Classic UI. Use HSCompareRecipesPage from @/modules/hopskip/components/public/ instead. See HOPSKIP_MIGRATION_PRD.md §1.3.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/BrewDayChecklistSection',
            ],
            message:
              'Classic UI. Use HSBrewSheetSection from @/modules/hopskip/components/builder/ instead. See HOPSKIP_MIGRATION_PRD.md §2.5.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/BrewSessionPage',
            ],
            message:
              'Classic UI. Use HSBrewSheetSection in Brew Mode via HopSkipBuilder at /recipes/[id]?tab=brewsheet&session=<id>. See HOPSKIP_MIGRATION_PRD.md §2.5b.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_FermentableSection',
              '**/modules/beta-builder/presentation/components/OLD_FermentablePresetModal',
              '**/modules/beta-builder/presentation/components/OLD_CustomFermentableModal',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use FermentableSection from @/modules/hopskip/components/builder/ (with FermentablePresetModal / CustomFermentableModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.1.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_MashScheduleSection',
              '**/modules/beta-builder/presentation/components/OLD_MashStepModal',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use MashSection from @/modules/hopskip/components/builder/ (with MashStepModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.2.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_FermentationSection',
              '**/modules/beta-builder/presentation/components/OLD_FermentationStepModal',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use FermentationSection from @/modules/hopskip/components/builder/ (with FermentationStepModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.3.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_HopSection',
              '**/modules/beta-builder/presentation/components/OLD_HopAdditionRow',
              '**/modules/beta-builder/presentation/components/OLD_HopVarietyCard',
              '**/modules/beta-builder/presentation/components/OLD_HopFlavorRadar',
              '**/modules/beta-builder/presentation/components/OLD_HopFlavorMini',
              '**/modules/beta-builder/presentation/components/OLD_CustomHopModal',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use HopSection from @/modules/hopskip/components/builder/ (with HopPresetModal / CustomHopModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.8.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_YeastSection',
              '**/modules/beta-builder/presentation/components/OLD_StarterCalculator',
              '**/modules/beta-builder/presentation/components/OLD_CustomYeastModal',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use YeastSection from @/modules/hopskip/components/builder/ (with YeastPresetModal / CustomYeastModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.6.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_WaterSection',
              '**/modules/beta-builder/presentation/components/OLD_SourceWaterModal',
              '**/modules/beta-builder/presentation/components/OLD_CustomSourceWaterModal',
              '**/modules/beta-builder/presentation/components/OLD_TargetStyleModal',
              '**/modules/beta-builder/presentation/components/OLD_CustomTargetStyleModal',
              '**/modules/beta-builder/presentation/components/water-section/OLD_WaterChemistrySection',
              '**/modules/beta-builder/presentation/components/water-section/OLD_PhAdjustmentsSection',
              '**/modules/beta-builder/presentation/components/water-section/OLD_SaltAdditionsPanel',
              '**/modules/beta-builder/presentation/components/water-section/OLD_SaltSummary',
              '**/modules/beta-builder/presentation/components/water-section/OLD_WaterProfileComparison',
              '**/modules/beta-builder/presentation/components/water-section/OLD_WaterIonRangeStrip',
              '**/modules/beta-builder/presentation/components/water-section/OLD_OtherIngredientsPanel',
              '**/modules/beta-builder/presentation/components/water-section/OLD_WaterIngredientPickerModal',
              '**/modules/beta-builder/presentation/components/water-section/OLD_CustomWaterIngredientModal',
              '**/modules/beta-builder/presentation/components/water-section/OLD_WaterVolumesDisplay',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use WaterSection from @/modules/hopskip/components/builder/ (with SourceWaterPresetModal / CustomSourceWaterModal / TargetStylePresetModal / CustomTargetStyleModal / WaterIngredientPickerModal / CustomWaterIngredientModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.7.',
          },
          {
            group: [
              '**/modules/beta-builder/presentation/components/OLD_EquipmentSection',
              '**/modules/beta-builder/presentation/components/OLD_EquipmentProfileModal',
              '**/modules/beta-builder/presentation/components/OLD_CustomEquipmentModal',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use EquipmentSection from @/modules/hopskip/components/builder/ (with EquipmentProfileModal / CustomEquipmentModal in modals/) instead. See HOPSKIP_MIGRATION_PRD.md §2.4.',
          },
          {
            group: [
              '**/components/OLD_AbvCalculator',
              '**/components/OLD_BoilOffCalculator',
              '**/components/OLD_CarbonationCalculator',
              '**/components/OLD_DilutionCalculator',
              '**/components/OLD_HydrometerCorrectionCalculator',
              '**/components/OLD_StrikeTempCalculator',
            ],
            message:
              'Classic UI (OLD_ prefix marker). Use the HS-native equivalents from @/modules/hopskip/components/calculators/ (AbvCalculator, BoilOffCalculator, CarbonationCalculator, DilutionCalculator, HydrometerCorrectionCalculator, StrikeTempCalculator). See HOPSKIP_MIGRATION_PRD.md §3.',
          },
        ],
      }],
    },
  },
])
