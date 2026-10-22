import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000';
  const baselineTarget = env.VITE_COMPARE_BASELINE_TARGET || 'http://127.0.0.1:3000';
  const optimizedTarget = env.VITE_COMPARE_OPTIMIZED_TARGET || 'http://127.0.0.1:3001';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/v1': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
        '/compare-baseline': {
          target: baselineTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/compare-baseline/, ''),
        },
        '/compare-optimized': {
          target: optimizedTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/compare-optimized/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
