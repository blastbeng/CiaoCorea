import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serve il progetto sotto /CiaoCorea/: gli asset devono
  // dichiararlo, altrimenti al primo deploy il sito arriva senza CSS.
  base: '/CiaoCorea/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
