import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: "/pixel7/",
  plugins: [
    react(),
    // 🔄 Lit plugin (opzionale, tree-shaking auto)
  ],
  server: {
    force: true 
  },
  optimizeDeps: {
    include: ['lit', '@lit-labs/virtualizer']
  }
});
