import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@renderer': resolve('src/renderer'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/preload.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve('src'),
        '@renderer': resolve('src/renderer'),
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve('src'),
        '@renderer': resolve('src/renderer'),
      },
    },
  },
});
