import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 30000, hookTimeout: 30000,
    fileParallelism: false,
    reporters: ['default', ['json', { outputFile: '.artifacts/unit-results.json' }]],
    coverage: {
      provider: 'v8', include: ['src/**/*.{ts,tsx}'],
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: { lines: 80, branches: 70, functions: 80, statements: 80 }
    }
  }
});
