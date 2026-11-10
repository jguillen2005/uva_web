import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Dev: reenvía /api al gateway del backend (API_PROXY_TARGET, por defecto nginx :8080).
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        // Páginas legales del sitio web de Odoo (uva_legal) y sus recursos estáticos.
        '^/((aviso-de-privacidad|terminos-y-condiciones)/?|website/translations)([?].*)?$': {
          target: env.API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        '^/(web/assets|web/image|web/static|[a-z_]+/static)/': {
          target: env.API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
