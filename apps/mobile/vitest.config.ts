import { defineConfig } from 'vitest/config';

// Token and logic tests only — screens are exercised through the domain core,
// which is pure and needs no renderer.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
