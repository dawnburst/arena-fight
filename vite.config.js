import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/arena-fight/' : '/',
  server: {
    port: 5173,
    open: true,
    host: true,
  },
});
