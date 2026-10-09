import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 300000,
  },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
