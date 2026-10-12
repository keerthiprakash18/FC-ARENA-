import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Vite resolves tsconfig path aliases natively.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
  },
});
