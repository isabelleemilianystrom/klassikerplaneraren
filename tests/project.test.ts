import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * T-01 levererar projektuppsättningen. De här testerna kontrollerar att
 * uppsättningen håller det kravspecen kräver, så att den inte tyst glider
 * isär när projektet växer.
 */
describe('projektuppsättning', () => {
  const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
    compilerOptions: Record<string, unknown>;
  };
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };

  it('kör TypeScript i strikt läge', () => {
    expect(tsconfig.compilerOptions['strict']).toBe(true);
    expect(tsconfig.compilerOptions['noUncheckedIndexedAccess']).toBe(true);
  });

  it('har teknikvalen från kravspecens avsnitt 7', () => {
    const alla = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const paket of ['next', 'react', 'tailwindcss', 'zod', 'date-fns', 'vitest', 'eslint']) {
      expect(alla).toHaveProperty(paket);
    }
  });

  it('har inga beroenden till en AI-tjänst i körtid', () => {
    // Kravet A-08: förklaringarna är förgenererade, appen anropar ingen AI.
    const alla = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(alla.filter((namn) => namn.includes('anthropic'))).toEqual([]);
  });

  it('kan köra typkontroll, lint och tester', () => {
    for (const skript of ['typecheck', 'lint', 'test:run', 'check']) {
      expect(pkg.scripts).toHaveProperty(skript);
    }
  });
});
