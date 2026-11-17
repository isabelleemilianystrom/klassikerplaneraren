import next from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * `next lint` finns inte längre i Next 16, så ESLint körs direkt mot den här
 * flata konfigurationen.
 */
const config = [
  {
    // Byggkataloger ignoreras på alla nivåer, inte bara i roten: ett
    // git-worktree hamnar i `.claude/worktrees/`, alltså inuti repot, och har
    // ett eget bygge. Utan den bredare matchningen följde `eslint .` med dit
    // och underkände projektet på minifierad kod ur Next egna chunks.
    ignores: ['**/.next/**', '.claude/**', 'node_modules/**', 'next-env.d.ts', 'out/**'],
  },
  ...next,
  ...typescript,
];

export default config;
