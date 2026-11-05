import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the Vite server forwards API calls, so the browser sees one origin
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { charts: ['recharts'], react: ['react', 'react-dom', 'react-router-dom'] } },
    },
  },
  test: { environment: 'node' },
});
