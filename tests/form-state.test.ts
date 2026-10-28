import { describe, expect, it } from 'vitest';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import {
  hoursRange,
  initialState,
  selectedRaces,
  sportsToRate,
  toPlanInput,
  validateAll,
  validateStep1,
  validateStep2,
  validateStep3,
  type FormState,
} from '../src/ui/form-state.ts';

const IDAG = '2026-10-28';

/** Formuläret med ett lopp valt och allt annat giltigt. */
function ifyllt(): FormState {
  const state = initialState(IDAG);

  return {
    ...state,
    races: state.races.map((race) =>
      race.id === 'vasaloppet' ? { ...race, selected: true } : race,
    ),
    levels: { ski: 'experienced' },
  };
}

describe('K-02: steg 1, lopp och datum', () => {
  it('börjar med dagens datum som första träningsdag', () => {
    expect(initialState(IDAG).startDate).toBe(IDAG);
  });

  it('förifyller loppdatumen med nästa publicerade datum', () => {
    const vasa = initialState(IDAG).races.find((race) => race.id === 'vasaloppet');
    expect(vasa?.date).toBe('2027-03-07');
  });

  it('börjar utan något lopp valt', () => {
    expect(selectedRaces(initialState(IDAG))).toEqual([]);
  });

  it('kräver minst ett lopp', () => {
    expect(validateStep1(initialState(IDAG)).races).toBeDefined();
    expect(validateStep1(ifyllt()).races).toBeUndefined();
  });

  it('underkänner ett loppdatum före första träningsdagen', () => {
    const state: FormState = {
      ...ifyllt(),
      races: ifyllt().races.map((race) =>
        race.id === 'vasaloppet' ? { ...race, date: '2026-10-01' } : race,
      ),
    };

    expect(validateStep1(state)['date-vasaloppet']).toMatch(/före din första träningsdag/);
  });

  it('godtar ett lopp samma dag som starten', () => {
    const state: FormState = {
      ...ifyllt(),
      races: ifyllt().races.map((race) =>
        race.id === 'vasaloppet' ? { ...race, date: IDAG } : race,
      ),
    };

    expect(validateStep1(state)['date-vasaloppet']).toBeUndefined();
  });

  it('underkänner ett tomt datum på ett valt lopp', () => {
    const state: FormState = {
      ...ifyllt(),
      races: ifyllt().races.map((race) =>
        race.id === 'vasaloppet' ? { ...race, date: '' } : race,
      ),
    };

    expect(validateStep1(state)['date-vasaloppet']).toMatch(/Ange ett datum/);
  });

  it('underkänner ett datum som inte finns', () => {
    const state: FormState = {
      ...ifyllt(),
      races: ifyllt().races.map((race) =>
        race.id === 'vasaloppet' ? { ...race, date: '2027-02-30' } : race,
      ),
    };

    expect(validateStep1(state)['date-vasaloppet']).toMatch(/ÅÅÅÅ-MM-DD/);
  });

  it('bryr sig inte om datum på lopp som inte är valda', () => {
    const state: FormState = {
      ...ifyllt(),
      races: ifyllt().races.map((race) =>
        race.id === 'lidingoloppet' ? { ...race, date: 'struntprat' } : race,
      ),
    };

    expect(validateStep1(state)['date-lidingoloppet']).toBeUndefined();
  });

  it('underkänner en ogiltig första träningsdag', () => {
    expect(validateStep1({ ...ifyllt(), startDate: 'i morgon' }).startDate).toBeDefined();
  });
});

describe('K-03: steg 2, nivå per gren', () => {
  it('frågar bara om grenarna i de valda loppen', () => {
    expect(sportsToRate(ifyllt())).toEqual(['ski']);
  });

  it('frågar om alla fyra när alla fyra loppen är valda', () => {
    const alla: FormState = {
      ...initialState(IDAG),
      races: initialState(IDAG).races.map((race) => ({ ...race, selected: true })),
    };

    expect(sportsToRate(alla)).toEqual(['ski', 'bike', 'swim', 'run']);
  });

  it('kräver en nivå för varje gren', () => {
    const utanNivå: FormState = { ...ifyllt(), levels: {} };

    expect(validateStep2(utanNivå).levels).toBeDefined();
    expect(validateStep2(ifyllt()).levels).toBeUndefined();
  });

  it('bryr sig inte om nivåer för grenar som inte ingår', () => {
    const extra: FormState = { ...ifyllt(), levels: { ski: 'new' } };
    expect(validateStep2(extra)).toEqual({});
  });
});

describe('K-04: steg 3, tid, dagar och utrustning', () => {
  it('har standardvärdena från kravspecen', () => {
    const state = initialState(IDAG);

    expect(state.hoursPerWeek).toBe(6);
    expect(state.longSessionDay).toBe(7);
    expect(state.restDay).toBe(1);
    expect(Object.values(state.equipment).every((värde) => värde === false)).toBe(true);
  });

  it('tillåter 3 till 15 timmar', () => {
    const { min, max } = hoursRange();
    expect(min).toBe(3);
    expect(max).toBe(15);

    for (const timmar of [min, 6, max]) {
      expect(validateStep3({ ...ifyllt(), hoursPerWeek: timmar }).hoursPerWeek).toBeUndefined();
    }
    for (const timmar of [min - 1, max + 1, 0, 6.5]) {
      expect(validateStep3({ ...ifyllt(), hoursPerWeek: timmar }).hoursPerWeek).toBeDefined();
    }
  });

  it('underkänner samma dag för långpass och vila', () => {
    const samma: FormState = { ...ifyllt(), longSessionDay: 3, restDay: 3 };

    expect(validateStep3(samma).restDay).toMatch(/samma dag/);
    expect(validateStep3(ifyllt()).restDay).toBeUndefined();
  });

  it('godtar alla andra kombinationer av dagar', () => {
    for (let lång = 1; lång <= 7; lång += 1) {
      for (let vila = 1; vila <= 7; vila += 1) {
        if (lång === vila) continue;

        const state = {
          ...ifyllt(),
          longSessionDay: lång as 1,
          restDay: vila as 1,
        };
        expect(validateStep3(state).restDay, `${lång}/${vila}`).toBeUndefined();
      }
    }
  });
});

describe('formuläret till en plan', () => {
  it('ger null när något är fel', () => {
    expect(toPlanInput(initialState(IDAG), IDAG)).toBeNull();
    expect(toPlanInput({ ...ifyllt(), longSessionDay: 1, restDay: 1 }, IDAG)).toBeNull();
  });

  it('ger en plan som motorn kan använda', () => {
    const input = toPlanInput(ifyllt(), IDAG);

    expect(input).not.toBeNull();
    expect(input?.schemaVersion).toBe(2);
    expect(input?.races).toEqual([{ id: 'vasaloppet', date: '2027-03-07' }]);
    expect(input?.levels).toEqual({ ski: 'experienced' });
    expect(input?.preferredDays).toEqual({ longSession: 7, rest: 1 });
  });

  it('ger en plan motorn faktiskt kan bygga veckor av', () => {
    const input = toPlanInput(ifyllt(), IDAG);
    const planer = buildWeekPlans(input as never);

    expect(planer.length).toBeGreaterThan(0);
    for (const plan of planer) {
      expect(plan.sessions.length).toBe(7);
    }
  });

  it('tar bara med grenar som ingår i de valda loppen', () => {
    // Nivåer för grenar som inte ska tävlas i ska inte följa med.
    const medExtra: FormState = {
      ...ifyllt(),
      levels: { ski: 'new', swim: 'advanced', bike: 'advanced', run: 'advanced' },
    };

    expect(toPlanInput(medExtra, IDAG)?.levels).toEqual({ ski: 'new' });
  });

  it('bygger en plan för alla fyra loppen', () => {
    const alla: FormState = {
      ...initialState(IDAG),
      races: initialState(IDAG).races.map((race) => ({ ...race, selected: true })),
      levels: { ski: 'new', bike: 'experienced', swim: 'new', run: 'experienced' },
      equipment: { snowOrRollerSkis: true, skiErg: false, pool: true, bike: true },
    };

    expect(validateAll(alla)).toEqual({});

    const planer = buildWeekPlans(toPlanInput(alla, IDAG) as never);
    expect(planer.length).toBeGreaterThan(40);
  });
});
