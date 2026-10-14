import { describe, expect, it } from 'vitest';
import type { Discipline, PlanInput, Program } from '../types';
import { DISCIPLINES } from '../types';
import { isMonday, startOfWeek } from './dates';
import { generateProgram } from './index';
import { isSnowWeek } from './season';

const today = '2026-10-13';

const baseInput: PlanInput = {
  variant: 'full',
  engelbrektsloppet: false,
  races: {
    skiing: '2027-03-07',
    cycling: '2027-06-18',
    swimming: '2027-07-03',
    running: '2027-09-25',
  },
  levels: {
    skiing: 'intermediate',
    cycling: 'intermediate',
    swimming: 'beginner',
    running: 'advanced',
  },
  hoursPerWeek: 8,
  snowSeason: { startMonth: 12, endMonth: 3 },
  equipment: { skiErgometer: true, rollerSkis: false, indoorTrainer: true },
};

function program(overrides: Partial<PlanInput> = {}): Program {
  return generateProgram({ ...baseInput, ...overrides }, today);
}

describe('generateProgram', () => {
  it('täcker hela perioden från dagens datum till efter det sista loppet', () => {
    const weeks = program().weeks;
    expect(weeks[0]?.startDate).toBe('2026-10-12');
    expect(weeks.at(-1)?.startDate).toBe('2027-09-27');
  });

  it('startar varje vecka på en måndag', () => {
    for (const week of program().weeks) {
      expect(isMonday(week.startDate)).toBe(true);
    }
  });

  it('håller varje veckas totala timmar inom hoursPerWeek', () => {
    for (const hoursPerWeek of [3, 5, 8, 14]) {
      for (const week of program({ hoursPerWeek }).weeks) {
        expect(week.totalHours).toBeLessThanOrEqual(hoursPerWeek);
      }
    }
  });

  it('summerar veckans timmar till passens timmar', () => {
    for (const week of program().weeks) {
      const sum = week.sessions.reduce((total, session) => total + session.hours, 0);
      expect(week.totalHours).toBeCloseTo(sum, 10);
    }
  });

  it('lägger en nedtrappningsvecka den vecka varje lopp går', () => {
    const weeks = program().weeks;
    for (const date of Object.values(baseInput.races)) {
      const week = weeks.find((candidate) => candidate.startDate === startOfWeek(date));
      expect(week?.phase).toBe('taper');
    }
  });

  it('lägger en återhämtningsvecka efter varje lopp', () => {
    const weeks = program().weeks;
    for (const date of Object.values(baseInput.races)) {
      const index = weeks.findIndex((week) => week.startDate === startOfWeek(date));
      const next = weeks[index + 1];
      expect(next?.followsRace).toBe(true);
    }
  });

  it('toppar formen separat mot lopp som har veckor nog före sig', () => {
    const weeks = program().weeks;
    for (const discipline of ['skiing', 'cycling', 'running'] as Discipline[]) {
      const peaks = weeks.filter(
        (week) => week.phase === 'peak' && week.targetRace === discipline,
      );
      expect(peaks.length).toBeGreaterThan(0);
    }
  });

  it('ersätter skidpass utanför snöperioden i stället för att ta bort dem', () => {
    for (const week of program().weeks) {
      const inSnow = isSnowWeek(week.startDate, baseInput.snowSeason);
      for (const session of week.sessions) {
        if (session.discipline !== 'skiing') continue;
        if (inSnow) {
          expect(session.substitute).toBeUndefined();
        } else {
          expect(session.substitute).toBeDefined();
        }
      }
    }
  });

  it('väljer ersättningsform efter utrustningen', () => {
    const withErg = program({
      equipment: { skiErgometer: true, rollerSkis: false, indoorTrainer: false },
    });
    const withNothing = program({
      equipment: { skiErgometer: false, rollerSkis: false, indoorTrainer: false },
    });
    expect(substitutes(withErg)).toContain('skiErgometer');
    expect(substitutes(withNothing)).toEqual(['polesAndStrength']);
  });

  it('håller nybörjargrenar igång hela vägen, inte bara nära loppet', () => {
    // Simning är nybörjargren och simloppet ligger nio månader bort.
    const firstMonth = program().weeks.slice(0, 4);
    for (const week of firstMonth) {
      const swims = week.sessions.filter((session) => session.discipline === 'swimming');
      expect(swims.length).toBeGreaterThan(0);
    }
  });

  it('ger nybörjare i simning teknikpass, inte bara distans', () => {
    const swims = program()
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.discipline === 'swimming');
    expect(swims.some((session) => session.purpose === 'technique')).toBe(true);
  });

  it('låter grenar man behärskar vila tills de blir nästa lopp', () => {
    // Löpning är "advanced" och löparloppet ligger sist — ingen löpning i höst.
    const firstWeeks = program().weeks.slice(0, 8);
    const runs = firstWeeks.flatMap((week) =>
      week.sessions.filter((session) => session.discipline === 'running'),
    );
    expect(runs).toHaveLength(0);
  });

  it('ger varje pass gren, omfattning och syfte', () => {
    for (const week of program().weeks) {
      for (const session of week.sessions) {
        expect(DISCIPLINES).toContain(session.discipline);
        expect(session.hours).toBeGreaterThan(0);
        expect(session.purpose).toBeTruthy();
      }
    }
  });

  it('ger samma program för samma indata och samma dagens datum', () => {
    expect(program()).toEqual(program());
  });

  it('varnar när timbudgeten är för liten för varianten', () => {
    expect(program({ hoursPerWeek: 3 }).warnings).toContain('tightBudget');
    expect(program({ hoursPerWeek: 10 }).warnings).not.toContain('tightBudget');
    // Fyra timmar räcker för Korta men inte för hela klassikern.
    expect(program({ hoursPerWeek: 4, variant: 'short' }).warnings).not.toContain('tightBudget');
    expect(program({ hoursPerWeek: 4 }).warnings).toContain('tightBudget');
  });

  it('varnar när skidersättning saknas helt', () => {
    const warnings = program({
      equipment: { skiErgometer: false, rollerSkis: false, indoorTrainer: false },
    }).warnings;
    expect(warnings).toContain('noSkiSubstitute');
  });

  it('avvisar loppdatum som redan har varit', () => {
    expect(() =>
      generateProgram({ ...baseInput, races: { ...baseInput.races, cycling: '2026-06-19' } }, today),
    ).toThrow(/redan/);
  });

  it('avvisar loppdatum som inte ligger inom en tolvmånadersperiod', () => {
    expect(() =>
      generateProgram({ ...baseInput, races: { ...baseInput.races, running: '2028-04-01' } }, today),
    ).toThrow(/tolv månader/);
  });

  it('sparar indata och dagens datum i programmet', () => {
    const result = program();
    expect(result.version).toBe(1);
    expect(result.createdAt).toBe(today);
    expect(result.input).toEqual(baseInput);
  });

  it('är serialiserbart utan att tappa något', () => {
    const result = program();
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});

function substitutes(result: Program): string[] {
  const found = new Set<string>();
  for (const week of result.weeks) {
    for (const session of week.sessions) {
      if (session.substitute !== undefined) found.add(session.substitute);
    }
  }
  return [...found];
}
