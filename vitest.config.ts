import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/calculators/**', 'src/modules/beta-builder/domain/**', 'src/utils/**'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
    },
  },
  resolve: {
    alias: {
      '@/': '/src/',
      '@components': '/src/components',
      '@pages': '/src/views',
      '@calculators': '/src/calculators',
      '@utils': '/src/utils',
    },
  },
});
