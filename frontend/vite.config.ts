import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const port = loadEnv(mode, '..', 'PORT').PORT || '8000';
  const backend = `http://127.0.0.1:${port}`;
  const proxy = {
    '/api': { target: backend, changeOrigin: true },
    '/ws': { target: backend, ws: true },
  };

  return {
    plugins: [react()],
    server: { host: '0.0.0.0', port: 5173, proxy },
    preview: { proxy },
    build: { outDir: 'dist', emptyOutDir: true },
  };
});
