import { beforeEach, describe, expect, it } from 'vitest';
import { clearProgram, loadProgram, saveProgram } from './storage';
import type { Program } from './types';

/** Minimal localStorage för tester — ingen jsdom behövs. */
class FakeStorage implements Storage {
  private items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function emptyProgram(): Program {
  return {
    version: 1,
    createdAt: '2026-01-05',
    input: {
      variant: 'full',
      engelbrektsloppet: false,
      races: {
        skiing: '2027-03-07',
        cycling: '2026-06-19',
        swimming: '2026-07-04',
        running: '2026-09-26',
      },
      levels: {
        skiing: 'beginner',
        cycling: 'intermediate',
        swimming: 'beginner',
        running: 'advanced',
      },
      hoursPerWeek: 6,
      snowSeason: { startMonth: 12, endMonth: 3 },
    },
    weeks: [],
  };
}

describe('storage', () => {
  let fake: FakeStorage;

  beforeEach(() => {
    fake = new FakeStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true });
  });

  it('sparar och läser tillbaka samma program', () => {
    const program = emptyProgram();
    expect(saveProgram(program)).toBe(true);
    expect(loadProgram()).toEqual(program);
  });

  it('ger null när inget är sparat', () => {
    expect(loadProgram()).toBeNull();
  });

  it('ger null när innehållet inte är giltig JSON', () => {
    fake.setItem('klassikerplaneraren.program', '{trasigt');
    expect(loadProgram()).toBeNull();
  });

  it('ger null när versionen är okänd', () => {
    fake.setItem('klassikerplaneraren.program', JSON.stringify({ version: 99, weeks: [] }));
    expect(loadProgram()).toBeNull();
  });

  it('tar bort sparat program', () => {
    saveProgram(emptyProgram());
    clearProgram();
    expect(loadProgram()).toBeNull();
  });

  it('kraschar inte när lagring saknas', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    expect(saveProgram(emptyProgram())).toBe(false);
    expect(loadProgram()).toBeNull();
    expect(() => clearProgram()).not.toThrow();
  });
});
