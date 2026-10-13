import { defineConfig } from 'vitest/config';

// base måste matcha repo-namnet för att GitHub Pages ska hitta tillgångarna
// på https://<användare>.github.io/klassikerplaneraren/
export default defineConfig({
  base: '/klassikerplaneraren/',
  test: {
    // Ingen jsdom: logiken är ren och testas utan DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
