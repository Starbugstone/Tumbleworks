import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    host: true,
    port: 5180,
    strictPort: true,
    allowedHosts: ['game-server'],
  },
  preview: {
    allowedHosts: ['game-server'],
  },
  optimizeDeps: {
    // Listed so the first page load doesn't stall while the dev server discovers them.
    include: [
      'three',
      'three/examples/jsm/utils/BufferGeometryUtils.js',
      'three/examples/jsm/geometries/RoundedBoxGeometry.js',
      'three/examples/jsm/environments/RoomEnvironment.js',
      '@dimforge/rapier3d-compat',
    ],
  },
  test: {
    include: ['tests/rules/**/*.test.ts', 'tests/loop/**/*.test.ts', 'tests/machine/**/*.test.ts', 'tests/puzzles/**/*.test.ts', 'tests/engine/**/*.test.ts', 'tests/levelling/**/*.test.ts'],
  },
});
