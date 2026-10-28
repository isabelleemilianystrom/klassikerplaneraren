import { describe, expect, it } from 'vitest';
import { rules } from '../src/engine/config.ts';
import { addDays } from '../src/engine/dates.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import {
  currentWeekIndex,
  formatDay,
  formatMinutes,
  formatWeekRange,
  formatZone,
  groupByPhase,
  phaseName,
  racesInWeek,
  totalHours,
  weekFocus,
} from '../src/ui/plan-view.ts';
import { P1, P2, P4 } from './profiles.ts';

const PLANER = buildWeekPlans(P1);

describe('tid och datum', () => {
  it('skriver minuter under en timme som minuter', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(59)).toBe('59 min');
  });

  it('skriver hela timmar utan minuter', () => {
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(120)).toBe('2 h');
  });

  it('skriver timmar och minuter', () => {
    expect(formatMinutes(95)).toBe('1 h 35 min');
    expect(formatMinutes(301)).toBe('5 h 1 min');
  });

  it('skriver en vecka inom samma månad kort', () => {
    expect(formatWeekRange('2027-03-01')).toBe('1–7 mars');
  });

  it('skriver ut båda månaderna när veckan spänner över ett månadsskifte', () => {
    expect(formatWeekRange('2026-11-30')).toBe('30 nov–6 dec');
    expect(formatWeekRange('2027-03-29')).toBe('29 mars–4 april');

    // 22 februari plus sex dagar är 28 februari — samma månad.
    expect(formatWeekRange('2027-02-22')).toBe('22–28 feb');
  });

  it('skriver en dag med veckodag och månad', () => {
    expect(formatDay('2027-03-07', 7)).toBe('sön 7 mars');
    expect(formatDay('2026-11-02', 1)).toBe('mån 2 nov');
  });
});

describe('K-07: intensiteten i vardagsspråk', () => {
  it('skriver beskrivningen först och zonen inom parentes', () => {
    expect(formatZone(2)).toBe('Lugnt – du ska kunna prata hela meningar (zon 2)');
    expect(formatZone(4)).toBe('Hårt – bara några ord i taget (zon 4)');
  });

  it('använder texterna ur konfigurationen', () => {
    for (const zon of [1, 2, 3, 4] as const) {
      expect(formatZone(zon)).toContain(rules.intensity.zoneText[String(zon) as '1']);
    }
  });

  it('ger ingen text för pass utan zon', () => {
    expect(formatZone(null)).toBeNull();
  });
});

describe('K-06: översikten', () => {
  it('ger varje fas ett eget namn', () => {
    expect(phaseName('base')).toBe('Grund');
    expect(phaseName('specific')).toBe('Loppspecifik');
    expect(phaseName('taper')).toBe('Nedtrappning');
    expect(phaseName('recovery')).toBe('Återhämtning');
  });

  it('grupperar veckorna i sina faser', () => {
    const grupper = groupByPhase(PLANER);

    expect(grupper.length).toBeGreaterThan(1);

    // Varje grupp har ett eget phaseId, och summan är alla veckor.
    const id = grupper.map((grupp) => grupp.phaseId);
    expect(new Set(id).size).toBe(grupper.length);
    expect(grupper.reduce((a, grupp) => a + grupp.weeks.length, 0)).toBe(PLANER.length);
  });

  it('håller veckorna i ordning inom och mellan grupperna', () => {
    const index = groupByPhase(PLANER).flatMap((grupp) =>
      grupp.weeks.map((plan) => plan.week.index),
    );

    expect(index).toEqual(PLANER.map((plan) => plan.week.index));
  });

  it('märker loppveckorna med loppets namn', () => {
    const loppveckor = PLANER.filter((plan) => plan.week.raceIds.length > 0);

    expect(loppveckor.length).toBe(P1.races.length);
    for (const plan of loppveckor) {
      expect(racesInWeek(plan).length).toBe(plan.week.raceIds.length);
      expect(racesInWeek(plan)[0]?.length).toBeGreaterThan(0);
    }
  });

  it('ger vanliga veckor inget lopp', () => {
    const utanLopp = PLANER.filter((plan) => plan.week.raceIds.length === 0);
    expect(utanLopp.length).toBeGreaterThan(0);

    for (const plan of utanLopp) {
      expect(racesInWeek(plan)).toEqual([]);
    }
  });

  it('räknar planens totala tid i timmar', () => {
    const minuter = PLANER.reduce((a, plan) => a + plan.totalMinutes, 0);
    expect(totalHours(PLANER)).toBe(Math.round(minuter / 60));
  });
});

describe('veckans fokus', () => {
  it('sätter loppet på veckan, inte på passen', () => {
    // Lärdomen från v0: "intervaller mot Vasaloppet" på varje rad gör ett
    // missat pass till ett missat lopp.
    const vecka = PLANER.find((plan) => plan.week.focusRaceId === 'vasaloppet');
    expect(weekFocus(vecka as never)).toContain('Vasaloppet');

    for (const session of vecka?.sessions ?? []) {
      expect(session.title).not.toContain('Vasaloppet');
    }
  });

  it('skriver bara fasen när veckan saknar fokuslopp', () => {
    const utanFokus = PLANER.find((plan) => plan.week.focusRaceId === null);
    if (utanFokus === undefined) return;

    expect(weekFocus(utanFokus)).toBe(phaseName(utanFokus.week.phase));
  });
});

describe('K-16: innevarande vecka', () => {
  it('hittar veckan som innehåller dagens datum', () => {
    const vecka = PLANER[10];
    const mitt = addDays(vecka?.week.startDate as string, 3);

    expect(currentWeekIndex(PLANER, mitt)).toBe(vecka?.week.index);
  });

  it('hittar rätt vecka på veckans första och sista dag', () => {
    const vecka = PLANER[5];
    const start = vecka?.week.startDate as string;

    expect(currentWeekIndex(PLANER, start)).toBe(vecka?.week.index);
    expect(currentWeekIndex(PLANER, addDays(start, 6))).toBe(vecka?.week.index);
  });

  it('pekar på första veckan när planen ännu inte börjat', () => {
    // Den som skapat sin plan i förväg ska se var den börjar, inte ingenting.
    const före = addDays(PLANER[0]?.week.startDate as string, -30);
    expect(currentWeekIndex(PLANER, före)).toBe(1);
  });

  it('pekar ingenstans när planen är slut', () => {
    const sista = PLANER.at(-1)?.week.startDate as string;
    expect(currentWeekIndex(PLANER, addDays(sista, 7))).toBeNull();
  });

  it('täcker varje dag i planen', () => {
    // Ingen dag får falla mellan två veckor.
    for (const plan of PLANER) {
      for (let dag = 0; dag < 7; dag += 1) {
        const datum = addDays(plan.week.startDate, dag);
        expect(currentWeekIndex(PLANER, datum), datum).toBe(plan.week.index);
      }
    }
  });

  it('fungerar för en kort plan', () => {
    const kort = buildWeekPlans(P4);
    expect(currentWeekIndex(kort, kort[0]?.week.startDate as string)).toBe(1);
  });
});

describe('planvyn för alla profiler', () => {
  it('kan formatera varje vecka i P1 och P2', () => {
    for (const planer of [buildWeekPlans(P1), buildWeekPlans(P2)]) {
      for (const plan of planer) {
        expect(formatWeekRange(plan.week.startDate).length).toBeGreaterThan(0);
        expect(formatMinutes(plan.totalMinutes).length).toBeGreaterThan(0);
        expect(weekFocus(plan).length).toBeGreaterThan(0);

        for (const session of plan.sessions) {
          expect(formatDay(session.date, 1).length).toBeGreaterThan(0);
        }
      }
    }
  });
});
