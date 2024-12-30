import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: true,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
        secure: false,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@utils': resolve(__dirname, 'src/utils'),
      '@config': resolve(__dirname, 'src/config')
    }
  }
});
