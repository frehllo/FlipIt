import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: "/FlipIt/",
  plugins: [
    react(),
  ],
  server: {
    force: true 
  },
  optimizeDeps: {
    include: ['lit', '@lit-labs/virtualizer']
  }
});
