import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
  },
  test: {
    include: ['tests/sim/**/*.test.ts'],
  },
});
