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
    version: 2,
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
      openWaterSeason: { startMonth: 6, endMonth: 8 },
      equipment: { skiErgometer: true, rollerSkis: false, indoorTrainer: true },
      goals: { skiing: 'finish', cycling: 'improve', swimming: 'finish', running: 'time' },
      trainingDays: { daysPerWeek: 4, longSessionDay: 7, unavailableDays: [] },
    },
    blocks: [],
    weeks: [],
    warnings: [],
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
    expect(loadProgram()).toEqual({ program, discarded: false });
  });

  it('säger att inget finns när inget är sparat', () => {
    expect(loadProgram()).toEqual({ program: null, discarded: false });
  });

  it('kastar innehåll som inte är giltig JSON', () => {
    fake.setItem('klassikerplaneraren.program', '{trasigt');
    expect(loadProgram()).toEqual({ program: null, discarded: true });
  });

  it('kastar program med okänd version', () => {
    fake.setItem('klassikerplaneraren.program', JSON.stringify({ version: 99, weeks: [] }));
    expect(loadProgram().program).toBeNull();
  });

  /**
   * Programobjektet bytte form fem gånger medan versionen stod kvar på 1.
   * Resultatet var att gamla program lästes in som om de vore nya och tog ner
   * hela appen. De här testerna låser fast att det inte kan hända igen.
   */
  it('kastar program från en äldre version av formatet', () => {
    const gammalt = { ...emptyProgram(), version: 1 };
    fake.setItem('klassikerplaneraren.program', JSON.stringify(gammalt));
    expect(loadProgram()).toEqual({ program: null, discarded: true });
  });

  it('kastar program där input saknas helt', () => {
    fake.setItem(
      'klassikerplaneraren.program',
      JSON.stringify({ version: 2, createdAt: '2026-01-05', weeks: [], blocks: [], warnings: [] }),
    );
    expect(loadProgram().discarded).toBe(true);
  });

  it('kastar program där input är null', () => {
    fake.setItem(
      'klassikerplaneraren.program',
      JSON.stringify({ version: 2, createdAt: '2026-01-05', input: null, weeks: [], blocks: [], warnings: [] }),
    );
    expect(loadProgram().discarded).toBe(true);
  });

  it('kastar program där en gren saknas i indata', () => {
    const program = emptyProgram();
    const utanSimning = { ...program, input: { ...program.input, goals: { skiing: 'finish', cycling: 'finish', running: 'finish' } } };
    fake.setItem('klassikerplaneraren.program', JSON.stringify(utanSimning));
    expect(loadProgram().discarded).toBe(true);
  });

  it('kastar program som saknar blocks eller warnings', () => {
    const program = emptyProgram() as unknown as Record<string, unknown>;
    delete program['blocks'];
    fake.setItem('klassikerplaneraren.program', JSON.stringify(program));
    expect(loadProgram().discarded).toBe(true);
  });

  it('rensar det som kastats, så att felet inte upprepas vid varje besök', () => {
    fake.setItem('klassikerplaneraren.program', '{trasigt');
    loadProgram();
    expect(fake.getItem('klassikerplaneraren.program')).toBeNull();
  });

  it('tar bort sparat program', () => {
    saveProgram(emptyProgram());
    clearProgram();
    expect(loadProgram().program).toBeNull();
  });

  it('kraschar inte när lagring saknas', () => {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    expect(saveProgram(emptyProgram())).toBe(false);
    expect(loadProgram()).toEqual({ program: null, discarded: false });
    expect(() => clearProgram()).not.toThrow();
  });
});
