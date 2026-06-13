import { defineConfig } from 'vite';

// base: './' keeps asset paths relative so the build drops straight onto
// itch.io / any static host (a Phase-0 funnel goal).
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  server: { port: 5173 },
  preview: { port: 4173 }
});
