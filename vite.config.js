import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/arena-fight/' : '/',
  server: {
    port: 5173,
    open: true,
    host: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: [],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions', 'junit'] : ['default'],
    outputFile: {
      junit: './junit.xml',
    },
    coverage: {
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: {
        lines: 80,
        branches: 60,
        functions: 80,
        statements: 80,
      },
      exclude: [
        'dist/**',
        'node_modules/**',
        'src/main.js', // Entry point usually excluded from unit tests
        'src/scenes/**', // Scenes are hard to cover 100% with unit tests
        '**/*.test.js',
      ],
    },
  },
});
