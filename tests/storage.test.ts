import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, load, save } from '../src/ui/storage.ts';
import { initialState, toPlanInput, type FormState } from '../src/ui/form-state.ts';
import type { PlanInput } from '../src/engine/types.ts';

const IDAG = '2026-10-28';
const NYCKEL = 'klassikerplaneraren';

/** En localStorage som går att få att gå sönder på de sätt riktiga gör. */
class FalskLagring {
  private data = new Map<string, string>();
  skrivFel: Error | null = null;
  läsFel: Error | null = null;

  getItem(nyckel: string): string | null {
    if (this.läsFel !== null) throw this.läsFel;
    return this.data.get(nyckel) ?? null;
  }

  setItem(nyckel: string, värde: string): void {
    if (this.skrivFel !== null) throw this.skrivFel;
    this.data.set(nyckel, värde);
  }

  removeItem(nyckel: string): void {
    this.data.delete(nyckel);
  }

  /** Lägger in rå data utan att gå via save, för att pröva inläsningen. */
  sätt(nyckel: string, värde: string): void {
    this.data.set(nyckel, värde);
  }

  har(nyckel: string): boolean {
    return this.data.has(nyckel);
  }
}

let lagring: FalskLagring;

/** Ett ifyllt formulär och dess indata. */
function ifyllt(): { form: FormState; input: PlanInput } {
  const start = initialState(IDAG);
  const form: FormState = {
    ...start,
    races: start.races.map((race) =>
      race.id === 'vasaloppet' ? { ...race, selected: true } : race,
    ),
    levels: { ski: 'experienced' },
  };

  return { form, input: toPlanInput(form, IDAG) as PlanInput };
}

beforeEach(() => {
  lagring = new FalskLagring();
  vi.stubGlobal('window', { localStorage: lagring });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('K-10: spara och läsa', () => {
  it('ger tomt när ingenting är sparat', () => {
    expect(load()).toEqual({ status: 'empty' });
  });

  it('sparar och läser tillbaka samma svar', () => {
    const { form, input } = ifyllt();

    expect(save(input, form)).toBe(true);

    const läst = load();
    expect(läst.status).toBe('ok');
    if (läst.status !== 'ok') return;

    expect(läst.input).toEqual(input);
    expect(läst.form).toEqual(form);
  });

  it('skriver över en tidigare sparad plan', () => {
    const första = ifyllt();
    save(första.input, första.form);

    const andra = {
      ...första,
      input: { ...första.input, hoursPerWeek: 12 },
    };
    save(andra.input, andra.form);

    const läst = load();
    expect(läst.status === 'ok' && läst.input.hoursPerWeek).toBe(12);
  });

  it('rensar lagringen när man ber om det', () => {
    const { form, input } = ifyllt();
    save(input, form);
    clear();

    expect(load()).toEqual({ status: 'empty' });
  });
});

describe('K-10: lagringen går inte alltid att använda', () => {
  it('kraschar inte när localStorage saknas helt', () => {
    vi.stubGlobal('window', {});

    expect(() => load()).not.toThrow();
    expect(load()).toEqual({ status: 'empty' });
    expect(save(ifyllt().input, ifyllt().form)).toBe(false);
  });

  it('kraschar inte utan window alls', () => {
    // Serverrendering, eller ett test utan DOM.
    vi.stubGlobal('window', undefined);

    expect(load()).toEqual({ status: 'empty' });
    expect(save(ifyllt().input, ifyllt().form)).toBe(false);
  });

  it('säger ifrån när det inte går att skriva', () => {
    // Privat läge och full disk ser ut så här.
    lagring.skrivFel = new Error('QuotaExceededError');

    const { form, input } = ifyllt();
    expect(save(input, form)).toBe(false);
  });

  it('kraschar inte när det inte går att läsa', () => {
    lagring.läsFel = new Error('SecurityError');
    expect(load()).toEqual({ status: 'empty' });
  });
});

describe('K-15: sparad plan valideras vid inläsning', () => {
  /** Lägger in rå data och läser tillbaka den. */
  function läs(rått: string) {
    lagring.sätt(NYCKEL, rått);
    return load();
  }

  it('kastar data som inte är JSON', () => {
    const svar = läs('inte json {{{');

    expect(svar).toEqual({ status: 'discarded', reason: 'unreadable' });
    expect(lagring.har(NYCKEL)).toBe(false);
  });

  it('kastar data från en äldre lagringsversion', () => {
    const { form, input } = ifyllt();
    const svar = läs(JSON.stringify({ storageVersion: 1, input, form }));

    expect(svar).toEqual({ status: 'discarded', reason: 'old-version' });
    expect(lagring.har(NYCKEL)).toBe(false);
  });

  it('kastar data utan versionsnummer', () => {
    const { form, input } = ifyllt();
    const svar = läs(JSON.stringify({ input, form }));

    expect(svar.status).toBe('discarded');
  });

  it('kastar indata med fel schemaVersion', () => {
    // Det här är v0-felet: versionen stämde, formen gjorde det inte.
    const { form, input } = ifyllt();
    const svar = läs(
      JSON.stringify({ storageVersion: 2, input: { ...input, schemaVersion: 1 }, form }),
    );

    expect(svar).toEqual({ status: 'discarded', reason: 'bad-input' });
  });

  it('kastar indata där ett fält saknas', () => {
    const { form, input } = ifyllt();

    for (const fält of ['startDate', 'races', 'levels', 'preferredDays', 'equipment'] as const) {
      const trasig = { ...input };
      delete (trasig as Record<string, unknown>)[fält];

      const svar = läs(JSON.stringify({ storageVersion: 2, input: trasig, form }));
      expect(svar.status, fält).toBe('discarded');
    }
  });

  it('kastar indata med ett ogiltigt datum', () => {
    const { form, input } = ifyllt();
    const svar = läs(
      JSON.stringify({ storageVersion: 2, input: { ...input, startDate: 'i går' }, form }),
    );

    expect(svar).toEqual({ status: 'discarded', reason: 'bad-input' });
  });

  it('kastar indata utan lopp', () => {
    const { form, input } = ifyllt();
    const svar = läs(JSON.stringify({ storageVersion: 2, input: { ...input, races: [] }, form }));

    expect(svar.status).toBe('discarded');
  });

  it('kastar indata där långpass och vila är samma dag', () => {
    // Motorn kastar på det här, så det får aldrig nå fram.
    const { form, input } = ifyllt();
    const svar = läs(
      JSON.stringify({
        storageVersion: 2,
        input: { ...input, preferredDays: { longSession: 3, rest: 3 } },
        form,
      }),
    );

    expect(svar).toEqual({ status: 'discarded', reason: 'bad-input' });
  });

  it('kastar indata med trasig utrustning', () => {
    const { form, input } = ifyllt();
    const svar = läs(
      JSON.stringify({
        storageVersion: 2,
        input: { ...input, equipment: { snowOrRollerSkis: 'ja' } },
        form,
      }),
    );

    expect(svar.status).toBe('discarded');
  });

  it('kastar ett trasigt formulärtillstånd', () => {
    const { input } = ifyllt();
    const svar = läs(JSON.stringify({ storageVersion: 2, input, form: { startDate: 42 } }));

    expect(svar).toEqual({ status: 'discarded', reason: 'bad-form' });
  });

  it('kastar null och primitiva värden', () => {
    for (const rått of ['null', '42', '"text"', '[]']) {
      lagring.sätt(NYCKEL, rått);
      expect(load().status, rått).toBe('discarded');
    }
  });

  it('rensar alltid lagringen när något kastas', () => {
    for (const rått of ['trasigt', 'null', JSON.stringify({ storageVersion: 99 })]) {
      lagring.sätt(NYCKEL, rått);
      load();
      expect(lagring.har(NYCKEL), rått).toBe(false);
    }
  });

  it('släpper igenom en giltig plan', () => {
    const { form, input } = ifyllt();
    const svar = läs(JSON.stringify({ storageVersion: 2, input, form }));

    expect(svar.status).toBe('ok');
    expect(lagring.har(NYCKEL)).toBe(true);
  });
});
