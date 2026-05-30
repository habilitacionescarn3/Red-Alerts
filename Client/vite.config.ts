import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // mqtt.js / aws-sdk browser builds occasionally reference `global`.
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id): string | undefined => {
          if (id.includes('node_modules')) {
            if (id.includes('maplibre-gl')) return 'maplibre';
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('@tanstack/react-query')) return 'query';
            if (id.includes('mqtt') || id.includes('@aws-sdk') || id.includes('@smithy') || id.includes('@aws-crypto')) {
              return 'realtime';
            }
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@radix-ui')) return 'ui-lib';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
