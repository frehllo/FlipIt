import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: "/pixel7/",
  plugins: [react()],
  server: {
    // Questo aiuta a risolvere i problemi di cache che abbiamo visto prima
    force: true 
  }
});