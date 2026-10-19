import { describe, expect, it } from 'vitest';
import type { Discipline, PlanInput, Program } from '../types';
import { DISCIPLINES } from '../types';
import { isMonday, startOfWeek, weekdayOf } from './dates';
import { generateProgram } from './index';
import { MAX_SESSION_HOURS } from './sessions';
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
  openWaterSeason: { startMonth: 6, endMonth: 8 },
  equipment: { skiErgometer: true, rollerSkis: false, indoorTrainer: true },
  goals: { skiing: 'finish', cycling: 'improve', swimming: 'finish', running: 'time' },
  trainingDays: { daysPerWeek: 4, longSessionDay: 7, unavailableDays: [] },
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

  it('varnar när timbudgeten är för liten för varianten och målet', () => {
    const finish = {
      skiing: 'finish',
      cycling: 'finish',
      swimming: 'finish',
      running: 'finish',
    } as const;

    expect(program({ hoursPerWeek: 3, goals: finish }).warnings).toContain('tightBudget');
    expect(program({ hoursPerWeek: 10, goals: finish }).warnings).not.toContain('tightBudget');
    // Fyra timmar räcker för Korta men inte för hela klassikern.
    expect(
      program({ hoursPerWeek: 4, variant: 'short', goals: finish }).warnings,
    ).not.toContain('tightBudget');
    expect(program({ hoursPerWeek: 4, goals: finish }).warnings).toContain('tightBudget');
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
    expect(result.version).toBe(3);
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

describe('mål, dagar och prioritering', () => {
  it('lägger långpasset på den önskade dagen', () => {
    const result = program({
      trainingDays: { daysPerWeek: 4, longSessionDay: 6, unavailableDays: [] },
    });
    for (const week of result.weeks) {
      const long = week.sessions.find((session) => session.purpose === 'longSession');
      if (long !== undefined) expect(long.day).toBe(6);
    }
  });

  it('lägger aldrig ett pass på en dag användaren inte kan träna', () => {
    const result = program({
      trainingDays: { daysPerWeek: 4, longSessionDay: 7, unavailableDays: [1, 2, 3] },
    });
    for (const week of result.weeks) {
      for (const session of week.sessions) {
        expect([1, 2, 3]).not.toContain(session.day);
      }
    }
  });

  it('håller sig inom antalet träningsdagar per vecka', () => {
    for (const daysPerWeek of [2, 3, 5]) {
      const result = program({
        trainingDays: { daysPerWeek, longSessionDay: 7, unavailableDays: [] },
      });
      for (const week of result.weeks) {
        const days = new Set(week.sessions.map((session) => session.day));
        expect(days.size).toBeLessThanOrEqual(daysPerWeek);
      }
    }
  });

  it('lägger högst två pass per dag, och då är det ena styrka', () => {
    // Styrka får dela dag med ett konditionspass — så gör folk i praktiken.
    // Två konditionspass samma dag är däremot alltid fel.
    for (const week of program().weeks) {
      const byDay = new Map<number, string[]>();
      for (const session of week.sessions) {
        byDay.set(session.day, [...(byDay.get(session.day) ?? []), session.kind]);
      }
      for (const kinds of byDay.values()) {
        expect(kinds.length).toBeLessThanOrEqual(2);
        if (kinds.length === 2) expect(kinds).toContain('strength');
      }
    }
  });

  it('märker varje pass som kondition eller styrka', () => {
    for (const week of program().weeks) {
      for (const session of week.sessions) {
        expect(['endurance', 'strength']).toContain(session.kind);
      }
    }
  });

  it('gör långpasset och kvalitetspasset till nyckelpass', () => {
    const week = program().weeks[0];
    const keys = week?.sessions.filter((session) => session.priority === 'key') ?? [];
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.length).toBeLessThanOrEqual(2);
  });

  it('gör styrka och underhåll till stödpass', () => {
    for (const week of program().weeks) {
      for (const session of week.sessions) {
        if (session.kind === 'strength') expect(session.priority).toBe('supporting');
      }
    }
  });

  it('ger mer kvalitetstid åt den som har ett tidsmål', () => {
    const goalFinish = { ...baseInput.goals, skiing: 'finish' } as const;
    const goalTime = { ...baseInput.goals, skiing: 'time' } as const;
    const quality = (result: Program): number =>
      result.weeks
        .filter((week) => week.targetRace === 'skiing')
        .flatMap((week) => week.sessions)
        .filter((session) => session.purpose === 'intervals')
        .reduce((sum, session) => sum + session.hours, 0);

    expect(quality(program({ goals: goalTime }))).toBeGreaterThan(
      quality(program({ goals: goalFinish })),
    );
  });

  it('delar in programmet i block med fokus på ett eller två lopp', () => {
    const result = program();
    expect(result.blocks.length).toBeGreaterThan(0);
    for (const block of result.blocks) {
      expect(block.focus.length).toBeGreaterThanOrEqual(1);
      expect(block.focus.length).toBeLessThanOrEqual(2);
    }
  });

  it('placerar varje vecka i ett block som finns', () => {
    const result = program();
    for (const week of result.weeks) {
      expect(result.blocks[week.block]).toBeDefined();
    }
  });
});

describe('loppbelastning och återhämtning', () => {
  it('lägger aldrig ett träningspass på loppdagen', () => {
    const result = program();
    for (const week of result.weeks) {
      if (week.races.length === 0) continue;
      const raceDay = weekdayOf((week.races[0] as { date: string }).date);
      for (const session of week.sessions) {
        expect(session.day).not.toBe(raceDay);
      }
    }
  });

  it('ger högst ett kort öppningspass dagen före loppet', () => {
    const result = program();
    for (const week of result.weeks) {
      if (week.races.length === 0) continue;
      const raceDay = weekdayOf((week.races[0] as { date: string }).date);
      const dayBefore = raceDay === 1 ? 7 : raceDay - 1;
      for (const session of week.sessions.filter((s) => s.day === dayBefore)) {
        expect(session.hours).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('räknar loppet som belastning och planerar nästan ingen träning i loppveckan', () => {
    const skiWeek = program().weeks.find((week) => week.races.some((r) => r.date === baseInput.races.skiing));
    // Vasaloppet tar omkring sju timmar. Veckan ska inte innehålla fyra timmar till.
    expect(skiWeek?.totalHours).toBeLessThanOrEqual(1);
  });

  it('ger två återhämtningsveckor efter ett långt lopp', () => {
    const weeks = program().weeks;
    const index = weeks.findIndex((week) => week.races.some((r) => r.date === baseInput.races.skiing));
    expect(weeks[index + 1]?.followsRace).toBe(true);
    expect(weeks[index + 2]?.followsRace).toBe(true);
  });

  it('ger en återhämtningsvecka efter ett kort lopp', () => {
    const weeks = program().weeks;
    const index = weeks.findIndex((week) => week.races.some((r) => r.date === baseInput.races.swimming));
    expect(weeks[index + 1]?.followsRace).toBe(true);
    expect(weeks[index + 2]?.followsRace).toBe(false);
  });
});

describe('passlängder och stegring', () => {
  it('planerar aldrig längre pass än grenen tål', () => {
    for (const week of program({ hoursPerWeek: 20 }).weeks) {
      for (const session of week.sessions) {
        expect(session.hours).toBeLessThanOrEqual(MAX_SESSION_HOURS[session.discipline]);
      }
    }
  });

  it('planerar aldrig simpass längre än en och en halv timme', () => {
    const swims = program({ hoursPerWeek: 20 })
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.discipline === 'swimming');
    expect(Math.max(...swims.map((s) => s.hours))).toBeLessThanOrEqual(1.5);
  });

  it('bygger upp långpasset mot loppet i stället för att hålla det konstant', () => {
    const cycling = program({ hoursPerWeek: 12 })
      .weeks.filter((week) => week.targetRace === 'cycling' && week.phase !== 'recovery')
      .map((week) =>
        Math.max(
          0,
          ...week.sessions.filter((s) => s.discipline === 'cycling').map((s) => s.hours),
        ),
      )
      .filter((hours) => hours > 0);

    const first = cycling[0] as number;
    const longest = Math.max(...cycling);
    expect(longest).toBeGreaterThan(first);
  });

  it('planerar styrkepass, och delar dag med ett konditionspass', () => {
    const weeks = program().weeks;
    const withStrength = weeks.filter((week) =>
      week.sessions.some((session) => session.kind === 'strength'),
    );
    expect(withStrength.length).toBeGreaterThan(weeks.length / 2);
  });

  it('lägger aldrig två konditionspass på samma dag', () => {
    for (const week of program().weeks) {
      const days = week.sessions
        .filter((session) => session.kind === 'endurance')
        .map((session) => session.day);
      expect(new Set(days).size).toBe(days.length);
    }
  });

  it('varnar när långpassen aldrig hinner bli långa nog för loppen', () => {
    expect(program({ hoursPerWeek: 5 }).warnings).toContain('longSessionTooShort');
  });
});

describe('teknik, intensitet och öppet vatten', () => {
  it('ger teknikpass för klassisk skidåkning när användaren inte är rutinerad', () => {
    const skiTechnique = program()
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.discipline === 'skiing' && session.purpose === 'technique');
    expect(skiTechnique.length).toBeGreaterThan(0);
  });

  it('hoppar över teknikpass för den som är rutinerad i grenen', () => {
    const advanced = program({
      levels: { ...baseInput.levels, skiing: 'advanced' },
    })
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.discipline === 'skiing' && session.purpose === 'technique');
    expect(advanced).toHaveLength(0);
  });

  it('ger varje pass en intensitet och ett upplägg', () => {
    for (const week of program().weeks) {
      for (const session of week.sessions) {
        expect(['easy', 'moderate', 'threshold', 'interval']).toContain(session.intensity);
        expect(session.structure).toBeTruthy();
      }
    }
  });

  it('kör långpass och teknikpass lugnt, och intervaller hårt', () => {
    for (const week of program().weeks) {
      for (const session of week.sessions) {
        if (session.purpose === 'longSession' || session.purpose === 'technique') {
          expect(session.intensity).toBe('easy');
        }
        if (session.purpose === 'intervals') {
          expect(['threshold', 'interval']).toContain(session.intensity);
        }
      }
    }
  });

  it('håller sig till den polariserade fördelningen: mest lugnt, lite hårt', () => {
    const sessions = program()
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.kind === 'endurance');
    const hard = sessions.filter((session) =>
      ['threshold', 'interval'].includes(session.intensity),
    );
    const hardShare = hard.reduce((sum, s) => sum + s.hours, 0) /
      sessions.reduce((sum, s) => sum + s.hours, 0);
    expect(hardShare).toBeLessThan(0.35);
  });

  it('lägger simpassen i öppet vatten under säsongen före simloppet', () => {
    const openWater = program()
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.openWater === true);
    expect(openWater.length).toBeGreaterThanOrEqual(2);
    for (const session of openWater) {
      expect(session.discipline).toBe('swimming');
    }
  });

  it('ger siktträning i öppet vatten-passen', () => {
    const skills = program()
      .weeks.flatMap((week) => week.sessions)
      .filter((session) => session.structure === 'openWaterSkills');
    expect(skills.length).toBeGreaterThan(0);
  });

  it('varnar när öppet vatten aldrig hinns med före simloppet', () => {
    // Öppet vatten bara i augusti, men simloppet går i början av juli: augusti
    // infaller först efter loppet, så användaren möter våtdräkten först då.
    const warnings = program({ openWaterSeason: { startMonth: 8, endMonth: 8 } }).warnings;
    expect(warnings).toContain('noOpenWaterBeforeSwim');
  });
});

describe('nivå och variant påverkar programmet', () => {
  it('ger den rutinerade mer hård träning än nybörjaren', () => {
    const hardHours = (level: 'beginner' | 'advanced'): number =>
      program({ levels: { ...baseInput.levels, cycling: level } })
        .weeks.filter((week) => week.targetRace === 'cycling')
        .flatMap((week) => week.sessions)
        .filter((session) => session.purpose === 'intervals')
        .reduce((sum, session) => sum + session.hours, 0);

    expect(hardHours('advanced')).toBeGreaterThan(hardHours('beginner'));
  });

  it('ger längre långpass i den hela klassikern än i den korta', () => {
    const longest = (variant: 'full' | 'short'): number =>
      Math.max(
        0,
        ...program({ variant, hoursPerWeek: 12 })
          .weeks.flatMap((week) => week.sessions)
          .filter((session) => session.discipline === 'cycling')
          .map((session) => session.hours),
      );

    expect(longest('full')).toBeGreaterThan(longest('short'));
  });

  it('ger kortare långpass på skidor när användaren åker Engelbrektsloppet', () => {
    const longest = (engelbrektsloppet: boolean): number =>
      Math.max(
        0,
        ...program({ engelbrektsloppet, hoursPerWeek: 12 })
          .weeks.flatMap((week) => week.sessions)
          .filter((session) => session.discipline === 'skiing')
          .map((session) => session.hours),
      );

    expect(longest(true)).toBeLessThanOrEqual(longest(false));
  });
});

describe('riktmärke och varningar följer målet', () => {
  const allGoals = (goal: 'finish' | 'improve' | 'time'): PlanInput['goals'] => ({
    skiing: goal,
    cycling: goal,
    swimming: goal,
    running: goal,
  });

  it('varnar inte för knappa timmar när målet bara är att ta sig runt', () => {
    // Sex timmar i veckan och målet "ta mig runt" är ett fullt rimligt upplägg
    // för någon som jobbar. Det ska inte ge en varning.
    const warnings = program({ hoursPerWeek: 6, goals: allGoals('finish') }).warnings;
    expect(warnings).not.toContain('tightBudget');
  });

  it('varnar för samma timmar när användaren har ett tidsmål', () => {
    const warnings = program({ hoursPerWeek: 6, goals: allGoals('time') }).warnings;
    expect(warnings).toContain('tightBudget');
  });

  it('kräver kortare långpass av den som vill ta sig runt', () => {
    const forGoal = (goal: 'finish' | 'time'): boolean =>
      program({ hoursPerWeek: 8, goals: allGoals(goal) }).warnings.includes('longSessionTooShort');

    // Samma timmar, men bara tidsmålet ska få varningen om för korta långpass.
    expect(forGoal('finish')).toBe(false);
    expect(forGoal('time')).toBe(true);
  });
});

describe('nästan tomma program', () => {
  it('varnar när de flesta veckorna saknar pass', () => {
    const warnings = program({ hoursPerWeek: 1 }).warnings;
    expect(warnings).toContain('mostlyEmpty');
  });

  it('varnar inte när veckorna har innehåll', () => {
    expect(program({ hoursPerWeek: 10 }).warnings).not.toContain('mostlyEmpty');
  });

  it('ger fortfarande ett program, inte ett fel, vid få timmar', () => {
    const result = program({ hoursPerWeek: 1 });
    expect(result.weeks.length).toBeGreaterThan(0);
    expect(result.blocks.length).toBeGreaterThan(0);
  });
});

describe('flera lopp samma vecka', () => {
  /** Cykelloppet fredag och simloppet söndag i samma vecka. */
  const sameWeek: PlanInput['races'] = {
    skiing: '2027-03-07',
    cycling: '2027-06-18',
    swimming: '2027-06-20',
    running: '2027-09-25',
  };

  it('tappar inte det andra loppet ur planen', () => {
    const weeks = program({ races: sameWeek }).weeks;
    const alla = weeks.flatMap((week) => week.races.map((race) => race.date));
    for (const date of Object.values(sameWeek)) {
      expect(alla).toContain(date);
    }
  });

  it('lägger båda loppen i samma vecka', () => {
    const week = program({ races: sameWeek }).weeks.find((w) => w.races.length > 1);
    expect(week?.races.map((race) => race.discipline)).toEqual(['cycling', 'swimming']);
  });

  it('räknar båda loppen som belastning, inte bara det första', () => {
    // Simloppet och löparloppet samma vecka. Två små lopp med flit: ett stort
    // lopp nollar veckan på egen hand, och då går skillnaden inte att mäta.
    const simOchLöpning: PlanInput['races'] = {
      skiing: '2027-03-07',
      cycling: '2027-06-18',
      swimming: '2027-07-03',
      running: '2027-07-04',
    };

    const tvåLopp = program({ races: simOchLöpning, hoursPerWeek: 20 }).weeks.find(
      (w) => w.races.length > 1,
    );
    const ettLopp = program({ hoursPerWeek: 20 }).weeks.find(
      (w) => w.races.length === 1 && w.races[0]?.discipline === 'swimming',
    );

    expect(tvåLopp?.races).toHaveLength(2);
    expect(tvåLopp?.totalHours).toBeLessThan(ettLopp?.totalHours ?? Infinity);
  });

  it('tränar inte på någon av loppdagarna', () => {
    const week = program({ races: sameWeek }).weeks.find((w) => w.races.length > 1);
    const loppdagar = week?.races.map((race) => weekdayOf(race.date)) ?? [];
    for (const session of week?.sessions ?? []) {
      expect(loppdagar).not.toContain(session.day);
    }
  });

  it('ger återhämtning efter det längsta av loppen', () => {
    const weeks = program({ races: sameWeek }).weeks;
    const index = weeks.findIndex((w) => w.races.length > 1);
    // Vätternrundan kräver två veckor, simloppet en. Det längre styr.
    expect(weeks[index + 1]?.followsRace).toBe(true);
    expect(weeks[index + 2]?.followsRace).toBe(true);
  });
});
