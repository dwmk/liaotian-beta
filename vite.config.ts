// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // This makes .md files from /public/pages/ available at /pages/*.md
  publicDir: 'public',

  // Ensure markdown files are treated as assets (critical!)
  assetsInclude: ['**/*.md'],

  // Optional: improve dev server performance
  optimizeDeps: {
    exclude: ['lucide-react'],
  },

  // This allows Vite dev server to serve files from public/
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  },

  build: {
    // Ensure markdown files are copied to dist/pages/
    assetsInclude: ['**/*.md'],
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
});
