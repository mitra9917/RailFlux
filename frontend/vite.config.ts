import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { compareK6Plugin } from './vite-plugin-compare-k6';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hmrEnabled = Boolean(process.env.RAILFLUX_HMR);

function apiProxy(apiTarget: string, baselineTarget: string, optimizedTarget: string) {
  return {
    '/v1': { target: apiTarget, changeOrigin: true },
    '/health': { target: apiTarget, changeOrigin: true },
    '/compare-baseline': {
      target: baselineTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/compare-baseline/, ''),
    },
    '/compare-optimized': {
      target: optimizedTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/compare-optimized/, ''),
    },
  };
}

/** HTML-only: `hmr: false` still injects /@vite/client. Never 204 that file — CSS imports it. */
function stripViteClientWhenHmrOff(): Plugin {
  return {
    name: 'railflux-strip-vite-client',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (hmrEnabled) return html;
        return html.replace(/<script type="module" src="\/@vite\/client"><\/script>\s*/g, '');
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000';
  const baselineTarget = env.VITE_COMPARE_BASELINE_TARGET || 'http://127.0.0.1:3000';
  const optimizedTarget = env.VITE_COMPARE_OPTIMIZED_TARGET || 'http://127.0.0.1:3001';
  const proxy = apiProxy(apiTarget, baselineTarget, optimizedTarget);

  return {
    plugins: [react(), tailwindcss(), compareK6Plugin(), stripViteClientWhenHmrOff()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      // ngrok is HTTPS on 443. Default HMR opens wss://<ngrok-host>:5173, fails,
      // then Vite reloads the page in a loop — Search stays on "Searching…".
      // Disable HMR for tunnel shares; set RAILFLUX_HMR=1 for localhost-only fast refresh.
      hmr: process.env.RAILFLUX_HMR ? { protocol: 'wss', clientPort: 443 } : false,
      proxy,
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
      allowedHosts: true,
      proxy,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
