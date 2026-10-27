import next from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

/**
 * `next lint` finns inte längre i Next 16, så ESLint körs direkt mot den här
 * flata konfigurationen.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  ...typescript,
];

export default config;
