import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The service worker and the two-phase precache are added in T028 (vite-plugin-pwa).
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
});
