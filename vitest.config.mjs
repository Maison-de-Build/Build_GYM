import { defineConfig } from 'vitest/config';

// Unit tests cover the app's PURE modules only — the derivations in src/utils
// that back the MDB screens (day strip, target load, est. time, intensity).
// Components are not rendered here; there is no React Native test renderer in
// this project and adding one is a separate decision.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    globals: false,
  },
});
