import { defineConfig } from 'vite';

export default defineConfig({
  define: { 'import.meta.env.DEV': 'false' },
  publicDir: false,
  build: {
    outDir: 'output/current/world-film-render',
    emptyOutDir: true,
    lib: { entry: 'scripts/world-film.ts', name: 'ValleyFilm', formats: ['iife'], fileName: () => 'film.js' },
  },
});
