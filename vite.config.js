import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/socket': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
