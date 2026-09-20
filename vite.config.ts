import { defineConfig } from 'vite';

// Static site, relative asset paths so dist/ works from any folder or CDN path.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('node_modules/phaser') ? 'phaser' : undefined;
        },
      },
    },
  },
  server: { host: true },
});
