import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/opensky-flight-simulator/' : '/',
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
});
