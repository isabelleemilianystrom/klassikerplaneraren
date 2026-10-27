import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Regelmotorn är ren TypeScript utan DOM, så ingen webbläsarmiljö behövs.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
