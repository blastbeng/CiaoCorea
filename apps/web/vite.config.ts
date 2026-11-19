import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Percorsi relativi: il sito deve reggersi sia sulla radice del dominio
  // (ciaocorea.fabiovalentino.it, il custom domain di GitHub Pages) sia sotto
  // /CiaoCorea/ (l'indirizzo blastbeng.github.io, che però reindirizza). Con una
  // base assoluta una delle due copie resta senza CSS e con una pagina vuota.
  base: './',
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
