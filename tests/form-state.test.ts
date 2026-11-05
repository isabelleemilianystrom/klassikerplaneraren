import { describe, expect, it } from 'vitest';
import { rules } from '../src/engine/config.ts';
import { addWeeks } from '../src/engine/dates.ts';
import { weekCount } from '../src/engine/weeks.ts';
import { PROFILES } from './profiles.ts';
import { EQUIPMENT, FORM } from '../src/ui/texts.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import type { PlanInput } from '../src/engine/types.ts';
import {
  hoursRange,
  initialState,
  selectedRaces,
  sportsToRate,
  toPlanInput,
  validateAll,
  latestRaceDate,
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

  it('tillåter 6 till 15 timmar', () => {
    // R-41: under sex timmar byggs inget program. Golvet står i
    // konfigurationen och formuläret läser det därifrån.
    const { min, max } = hoursRange();
    expect(min).toBe(6);
    expect(max).toBe(15);
    expect(min).toBe(rules.weeklyHours.min);

    for (const timmar of [min, 10, max]) {
      expect(validateStep3({ ...ifyllt(), hoursPerWeek: timmar }).hoursPerWeek).toBeUndefined();
    }
    // Tre och fem timmar var tillåtet förut och ska nu underkännas (R-41).
    for (const timmar of [min - 1, 3, 5, max + 1, 0, 6.5]) {
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
    expect(input?.schemaVersion).toBe(5);
    expect(input?.races).toEqual([{ id: 'vasaloppet', date: '2027-03-07', goal: 'finish' }]);
    expect(input?.levels).toEqual({ ski: 'experienced' });
    expect(input?.preferredDays).toEqual({ longSession: 7, rest: 1 });
  });

  it('ger en plan motorn faktiskt kan bygga veckor av', () => {
    const input = toPlanInput(ifyllt(), IDAG);
    const planer = buildWeekPlans(input as never);

    expect(planer.length).toBeGreaterThan(0);

    // Varje vecka har en rad per dag. Den första kan vara kortare: planen
    // börjar på måndagen i startdatumets vecka (R-01), och dagarna före
    // startdatumet är inte träningsdagar — de har redan passerat.
    for (const [i, plan] of planer.entries()) {
      if (i === 0) {
        expect(plan.sessions.length).toBeGreaterThan(0);
        expect(plan.sessions.length).toBeLessThanOrEqual(7);
        continue;
      }
      expect(plan.sessions.length, `vecka ${plan.week.index}`).toBe(7);
    }
  });

  it('lägger inga pass före startdatumet', () => {
    // F-1 ur den slumpade egenskapstestningen: 172 av 200 planer hade pass på
    // dagar som redan passerat, eftersom alla sex referensprofiler råkade
    // börja på en måndag.
    const state = ifyllt();
    const input = toPlanInput(state, IDAG);

    for (const plan of buildWeekPlans(input as never)) {
      for (const session of plan.sessions) {
        expect(session.date >= state.startDate, `${session.id} ${session.date}`).toBe(true);
      }
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
      equipment: { snow: true, rollerSkis: true, skiErg: false, indoorTrainer: true },
    };

    expect(validateAll(alla)).toEqual({});

    const planer = buildWeekPlans(toPlanInput(alla, IDAG) as never);
    expect(planer.length).toBeGreaterThan(40);
  });
});

describe('K-15: motorn kan misslyckas, och då ska användaren få veta', () => {
  it('har en text för att programmet inte kunde skapas', () => {
    // Förut returnerade skapaPlan tyst när motorn kastade, och knappen
    // "Skapa programmet" gjorde ingenting utan ett ord till användaren.
    const text = FORM.step3.errors.couldNotBuild;

    expect(text.length).toBeGreaterThan(40);
    expect(text).toMatch(/[åäö]/);
    expect(text).toMatch(/\.$/);

    // Tonen: säg att svaren finns kvar och vad man kan göra. Skyll inte.
    expect(text).toContain('finns kvar');
    expect(text).not.toMatch(/fel på dig|du gjorde|ogiltig|invalid/i);
  });

  it('kastar på indata som formuläret aldrig släpper igenom', () => {
    // Det är den här vägen meddelandet finns för. Ett okänt lopp-id kan bara
    // komma från en handskriven localStorage, och då ska appen säga något.
    const trasig = { ...toPlanInput(ifyllt(), IDAG), races: [{ id: 'tour-de-france', date: '2027-03-07', goal: 'finish' }] };

    expect(() => buildWeekPlans(trasig as never)).toThrow(/tour-de-france/);
  });
});

describe('R-01: planen har ett tak, så en felskrivning inte låser appen', () => {
  const TAK = rules.weekTime.maxPlanWeeks;

  it('har taket i konfigurationen, med gott om marginal', () => {
    // Den längsta riktiga planen i profilerna är 47 veckor. Taket ska vara
    // generöst — det är ett skyddsräcke, inte en träningsregel.
    expect(TAK).toBe(104);
    expect(rules.weekTime._maxPlanWeeks).toContain('skyddsräcke');

    for (const [namn, profil] of Object.entries(PROFILES)) {
      expect(weekCount(profil), namn).toBeLessThan(TAK);
    }
  });

  it('räknar ut sista tillåtna loppdatum ur taket', () => {
    const senast = latestRaceDate('2026-11-05');

    expect(senast).toBe(addWeeks('2026-11-05', TAK - 1));
    expect(latestRaceDate('inte ett datum')).toBeNull();
  });

  it('underkänner ett loppdatum längre fram än taket', () => {
    // Felskrivningen: 2927 i stället för 2027. Den gav 46 978 veckor och
    // låste webbläsaren, eftersom hängningen är synkron och inget catch
    // hinner emellan.
    const state: FormState = {
      ...ifyllt(),
      startDate: '2026-11-05',
      races: ifyllt().races.map((race) =>
        race.id === 'vasaloppet' ? { ...race, selected: true, date: '2927-03-07' } : race,
      ),
    };

    const fel = validateStep1(state);
    const text = fel['date-vasaloppet'];

    expect(text).toBeDefined();
    // Meddelandet ska säga vilket datum som är det sista tillåtna, inte en
    // regel att tolka.
    expect(text).toContain(latestRaceDate('2026-11-05'));
    expect(text).toMatch(/årtalet/);
  });

  it('släpper igenom ett datum precis på gränsen', () => {
    const senast = latestRaceDate('2026-11-05') as string;
    const state: FormState = {
      ...ifyllt(),
      startDate: '2026-11-05',
      races: ifyllt().races.map((race) =>
        race.id === 'vasaloppet' ? { ...race, selected: true, date: senast } : race,
      ),
    };

    expect(validateStep1(state)[`date-vasaloppet`]).toBeUndefined();
  });

  it('motorn vägrar bygga en plan över taket, i stället för att hänga', () => {
    const förLångt = {
      ...toPlanInput(ifyllt(), IDAG),
      races: [{ id: 'vasaloppet', date: '2927-03-07', goal: 'finish' }],
    };

    expect(() => buildWeekPlans(förLångt as never)).toThrow(/46978 veckor|mer än taket/);
  });

  it('motorn vägrar timmar utanför intervallet', () => {
    // Samma sorts hängning från andra sidan: sextio miljoner minuter att
    // dela ut per vecka.
    for (const timmar of [1000000, 0, -5, 6.5]) {
      const input = { ...toPlanInput(ifyllt(), IDAG), hoursPerWeek: timmar };
      expect(() => buildWeekPlans(input as never), `${timmar} h`).toThrow(/heltal mellan/);
    }
  });
});

describe('K-04: utrustningsfrågorna och modellen kan inte glida isär', () => {
  it('ger varje fråga ett standardvärde', () => {
    // S-9: listan i initialState stod kvar med snowOrRollerSkis, pool och
    // bike efter att modellen bytt form 2026-11-04. De tre nya flaggorna
    // saknades och ritades som omarkerade — vilket råkade bli rätt. Nu
    // härleds standardvärdena ur frågorna.
    const state = initialState(IDAG);

    for (const fråga of EQUIPMENT) {
      expect(state.equipment[fråga.key], fråga.key).toBe(false);
    }
  });

  it('har inga döda nycklar i standardvärdena', () => {
    const state = initialState(IDAG);
    const döda = Object.keys(state.equipment).filter(
      (nyckel) => !EQUIPMENT.some((fråga) => fråga.key === nyckel),
    );

    expect(döda).toEqual([]);
  });

  it('frågar om exakt de flaggor motorn läser', () => {
    // Den riktiga kopplingen: varje fråga ska nå fram till planen, och varje
    // flagga motorn läser ska ha en fråga. Går de isär svarar användaren på
    // något som inte används, eller används något hon inte svarat på.
    const input = toPlanInput(ifyllt(), IDAG) as PlanInput;

    expect(Object.keys(input.equipment).sort()).toEqual(
      EQUIPMENT.map((fråga) => fråga.key).sort(),
    );
  });

  it('bär svaret hela vägen från frågan till planen', () => {
    const state: FormState = {
      ...ifyllt(),
      equipment: Object.fromEntries(EQUIPMENT.map((fråga) => [fråga.key, true])),
    };

    const input = toPlanInput(state, IDAG) as PlanInput;
    for (const fråga of EQUIPMENT) {
      expect(input.equipment[fråga.key as 'snow'], fråga.key).toBe(true);
    }
  });
});
