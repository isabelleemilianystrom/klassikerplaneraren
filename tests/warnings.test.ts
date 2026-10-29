import { describe, expect, it } from 'vitest';
import { raceById, rules } from '../src/engine/config.ts';
import { addDays, addWeeks, startOfWeek } from '../src/engine/dates.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { midProgrammeStarts, midProgrammeWarnings } from '../src/engine/warnings.ts';
import type { PlanInput, RaceId } from '../src/engine/types.ts';
import { P1, P2, P4, P6, PROFILES } from './profiles.ts';

const GRÄNS = rules.warnings.midProgramme.weeksThreshold;
const START = '2026-11-02';

/** En plan med ett enda lopp ett bestämt antal veckor efter starten. */
function medVeckorKvar(weeks: number, raceId: RaceId = 'vasaloppet'): PlanInput {
  // Loppet läggs på lördagen i sin vecka, som de riktiga loppen ligger.
  const datum = addDays(addWeeks(startOfWeek(START), weeks), 5);

  return {
    ...P4,
    today: START,
    startDate: START,
    races: [{ id: raceId, date: datum, goal: 'finish' }],
  };
}

function starter(input: PlanInput) {
  return midProgrammeStarts(input, buildWeekPlans(input));
}

describe('R-35: start mitt i programmet', () => {
  it('varnar under gränsen och tiger på eller över den', () => {
    for (const veckor of [1, 5, GRÄNS - 1]) {
      expect(starter(medVeckorKvar(veckor)).length, `${veckor} veckor`).toBe(1);
    }

    for (const veckor of [GRÄNS, GRÄNS + 1, GRÄNS + 8]) {
      expect(starter(medVeckorKvar(veckor)), `${veckor} veckor`).toEqual([]);
    }
  });

  it('har gränsen satt till loppets hela uppbyggnad', () => {
    // Tio veckor är inte godtyckligt: det är nedtrappning plus specifik fas för
    // Vasaloppet och Vätternrundan. Startar man senare finns ingen grundperiod
    // kvar att göra.
    for (const id of ['vasaloppet', 'vatternrundan'] as const) {
      const config = raceById(id);
      expect(config.taperWeeks + config.specificWeeks, id).toBe(GRÄNS);
    }
  });

  it('säger hur många veckor som är kvar och vilket lopp det gäller', () => {
    const start = starter(medVeckorKvar(5))[0];

    expect(start?.weeksUntilRace).toBe(5);
    expect(start?.raceId).toBe('vasaloppet');
    expect(start?.weeksNeeded).toBe(GRÄNS);
  });

  it('märker när planen saknar grundperiod helt', () => {
    // P4 har sex veckor till Vasaloppet och börjar direkt i specifik fas.
    const start = starter(P4)[0];
    expect(start?.withoutBase).toBe(true);

    const faser = new Set(buildWeekPlans(P4).map((plan) => plan.week.phase));
    expect(faser.has('base')).toBe(false);
  });

  it('varnar men utan grundperiodstillägget när planen har bas senare', () => {
    // P6 startar sex veckor före Vätternrundan, men planen fortsätter till
    // Vasaloppet 2028 och har gott om grundperiod längre fram.
    const start = starter(P6)[0];

    expect(start?.weeksUntilRace).toBeLessThan(GRÄNS);
    expect(start?.withoutBase).toBe(false);

    const faser = new Set(buildWeekPlans(P6).map((plan) => plan.week.phase));
    expect(faser.has('base')).toBe(true);
  });

  it('varnar bara för det första loppet', () => {
    // De senare loppen har hela planen framför sig och bygger upp sig i tur och
    // ordning. Att varna för dem vore att varna för något som inte är ett fel.
    expect(starter(P1)).toEqual([]);
    expect(starter(P2)).toEqual([]);

    const sex = starter(medVeckorKvar(5));
    expect(sex.length).toBe(1);
  });

  it('tiger för profilerna med ett helt år framför sig', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      if (namn === 'P4' || namn === 'P6') continue;
      expect(starter(profil), namn).toEqual([]);
    }
  });

  it('gäller alla fyra loppen, inte bara de två långa', () => {
    for (const id of ['vasaloppet', 'vatternrundan', 'vansbrosimningen', 'lidingoloppet'] as const) {
      const input: PlanInput = {
        ...medVeckorKvar(4, id),
        levels: { ski: 'new', bike: 'new', swim: 'new', run: 'new' },
      };
      expect(starter(input).length, id).toBe(1);
    }
  });
});

describe('R-35: varningstexten', () => {
  it('säger att man hoppar in mitt i programmet', () => {
    const varning = midProgrammeWarnings(starter(medVeckorKvar(5)))[0] as string;

    expect(varning).toMatch(/mitt i programmet/);
    expect(varning).toMatch(/grundperiod/);
    expect(varning).toContain('Vasaloppet');
  });

  it('lägger till att grundperioden saknas helt när den gör det', () => {
    const utanBas = midProgrammeWarnings(starter(P4))[0] as string;
    const medBas = midProgrammeWarnings(starter(P6))[0] as string;

    expect(utanBas).toContain(rules.warnings.midProgramme.noBaseSuffix.trim());
    expect(medBas).not.toContain(rules.warnings.midProgramme.noBaseSuffix.trim());
  });

  it('böjer veckorna rätt', () => {
    expect(midProgrammeWarnings(starter(medVeckorKvar(1)))[0]).toContain('1 vecka till');
    expect(midProgrammeWarnings(starter(medVeckorKvar(5)))[0]).toContain('5 veckor till');

    // Loppet samma vecka som starten.
    expect(midProgrammeWarnings(starter(medVeckorKvar(0)))[0]).toContain('mindre än en vecka');
  });

  it('har inga ersättningsmarkörer kvar', () => {
    for (const veckor of [0, 1, 2, 5, GRÄNS - 1]) {
      for (const varning of midProgrammeWarnings(starter(medVeckorKvar(veckor)))) {
        expect(varning, `${veckor} veckor`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('säger att planen når distansen, inte att användaren tränar för lite', () => {
    const varning = midProgrammeWarnings(starter(P4))[0] as string;

    expect(varning).toContain('klara distansen');
    expect(varning).not.toMatch(/för lite|hinner inte bli|otillräckligt/i);
  });

  it('ger ingen text när det inte finns något att varna för', () => {
    expect(midProgrammeWarnings(starter(P1))).toEqual([]);
  });
});
