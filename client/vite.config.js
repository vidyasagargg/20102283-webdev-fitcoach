import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const envDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': loadEnv(mode, envDir, 'FITCOACH_').FITCOACH_API_TARGET ?? 'http://127.0.0.1:4000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: { environment: 'node' },
}));
