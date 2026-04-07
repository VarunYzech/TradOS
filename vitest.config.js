import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: [
      'tests/unit/**/*.test.js',
      'tests/property/**/*.property.test.js'
    ],
    globals: true
  }
});
