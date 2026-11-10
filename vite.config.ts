import { defineConfig } from 'vitest/config';
import { rapierInlineGzip } from './scripts/rapier-inline-gzip';

// Films ship with authored motion. The earlier mechanical certificates remain
// runnable research, including fixtures that require local archived receipts.
const shippingWorldTests = [
  'app-film-clock', 'assets', 'asset-surfaces', 'cooperative-diagnostics',
  'film-lifecycle', 'film-progress', 'house-surfaces', 'overview-layout',
  'painted-land', 'painted-land-oracle', 'painted-land-resource',
  'progression', 'project-rewards', 'render-lifecycle', 'scene-3d',
  'startup-lifecycle', 'valley-overview', 'village-flat-land',
  'village-identity', 'village-terrain', 'workshop-building',
  'workshop-marker', 'workshop-projects', 'workshop-site',
  'village-cinematic', 'village-cinematic-camera', 'village-cinematic-hardware',
  'village-cinematic-scene', 'village-cinematic-visibility',
].map(name => `tests/world/${name}.test.ts`);
const research = process.env.TW_VILLAGE_RESEARCH === '1';

export default defineConfig({
  plugins: [rapierInlineGzip()],
  server: {
    watch: { ignored: ['**/output/**'] },
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
    include: research ? ['tests/world/**/*.test.ts'] : [
      'tests/rules/**/*.test.ts', 'tests/loop/**/*.test.ts', 'tests/machine/**/*.test.ts',
      'tests/puzzles/**/*.test.ts', 'tests/engine/**/*.test.ts', 'tests/levelling/**/*.test.ts',
      ...shippingWorldTests,
    ],
    exclude: research ? shippingWorldTests : [],
    maxWorkers: 2,
  },
});
