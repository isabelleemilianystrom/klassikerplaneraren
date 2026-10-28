import { describe, expect, it } from 'vitest';
import { raceById, rules, sessions as sessionTexts } from '../src/engine/config.ts';
import { addDays, weekdayOf } from '../src/engine/dates.ts';
import { buildWeekPlans, trainingDayCount, type WeekPlan } from '../src/engine/sessions.ts';
import type { PlanInput, Session, Weekday } from '../src/engine/types.ts';
import { P1, P2, P3, P4, P5, P6, PROFILES } from './profiles.ts';

/** Passen som är riktig träning — vila räknas inte som ett pass. */
function träning(plan: WeekPlan): Session[] {
  return plan.sessions.filter((session) => session.type !== 'rest');
}

/** Dagarna i veckan som bär minst ett pass. */
function träningsdagar(plan: WeekPlan): string[] {
  return [...new Set(träning(plan).map((session) => session.date))];
}

function alla(): [string, WeekPlan[]][] {
  return Object.entries(PROFILES).map(([namn, profil]) => [namn, buildWeekPlans(profil)]);
}

describe('R-11: träningsdagar och vila', () => {
  it('ger 4 dagar upp till 5 timmar, 5 vid 6–9 och 6 från 10', () => {
    expect(trainingDayCount(3)).toBe(4);
    expect(trainingDayCount(5)).toBe(4);
    expect(trainingDayCount(6)).toBe(5);
    expect(trainingDayCount(9)).toBe(5);
    expect(trainingDayCount(10)).toBe(6);
    expect(trainingDayCount(15)).toBe(6);
  });

  it('lämnar minst en hel vilodag varje vecka', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const vila = plan.sessions.filter((session) => session.type === 'rest');
        expect(vila.length, `${namn} vecka ${plan.week.index}`).toBeGreaterThanOrEqual(
          rules.trainingDays.minRestDays,
        );
      }
    }
  });

  it('håller sig till antalet träningsdagar som T medger', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const tak = trainingDayCount(profil.hoursPerWeek);

      for (const plan of buildWeekPlans(profil)) {
        // Loppveckan har sina egna fasta dagar och räknas inte mot taket.
        if (plan.budget.raceMinutes > 0) continue;
        expect(träningsdagar(plan).length, `${namn} vecka ${plan.week.index}`).toBeLessThanOrEqual(
          tak,
        );
      }
    }
  });

  it('ger varje dag i veckan exakt en rad, vila inräknad', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const datum = new Set(plan.sessions.map((session) => session.date));
        expect(datum.size, `${namn} vecka ${plan.week.index}`).toBe(7);
      }
    }
  });
});

describe('R-12: passlängd', () => {
  it('ger inga pass under 20 eller över 300 minuter', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of träning(plan)) {
          // Loppet självt är inget planerat pass och har ingen övre gräns.
          if (session.type === 'race') continue;

          expect(session.minutes, `${namn} v${plan.week.index} ${session.id}`).toBeGreaterThanOrEqual(
            rules.session.minMinutes,
          );
          expect(session.minutes, `${namn} v${plan.week.index} ${session.id}`).toBeLessThanOrEqual(
            rules.session.maxMinutes,
          );
        }
      }
    }
  });

  it('ger vilopass noll minuter', () => {
    for (const [, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          if (session.type !== 'rest') continue;
          expect(session.minutes).toBe(0);
          expect(session.sport).toBeNull();
          expect(session.zone).toBeNull();
        }
      }
    }
  });
});

describe('R-13 och R-28: långpasset', () => {
  it('lägger ett långpass i loppets sport i specifik fas', () => {
    const specifika = buildWeekPlans(P2).filter(
      ({ week, budget }) => week.phase === 'specific' && budget.enduranceMinutes > 0,
    );
    expect(specifika.length).toBeGreaterThan(0);

    for (const plan of specifika) {
      const långa = träning(plan).filter((session) => session.type === 'long');
      expect(långa.length, `vecka ${plan.week.index}`).toBe(1);

      const loppetsSport = raceById(plan.week.focusRaceId as 'vasaloppet').sport;
      expect(långa[0]?.sport, `vecka ${plan.week.index}`).toBe(loppetsSport);
    }
  });

  it('lägger långpasset på den dag användaren valt', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const plan of buildWeekPlans(profil)) {
        for (const session of träning(plan)) {
          if (session.type !== 'long') continue;
          expect(weekdayOf(session.date), `${namn} v${plan.week.index} ${session.date}`).toBe(
            profil.preferredDays.longSession,
          );
        }
      }
    }
  });

  it('håller sportens tak enligt R-13', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of träning(plan)) {
          if (session.type !== 'long' || session.sport === null) continue;
          const tak = rules.longSession.capMinutesBySport[session.sport as 'ski'];
          expect(session.minutes, `${namn} v${plan.week.index} ${session.sport}`).toBeLessThanOrEqual(
            tak,
          );
        }
      }
    }
  });

  it('tar aldrig mer än 70 procent av veckans tid (R-28)', () => {
    // Vid T = 6 timmar skulle ett cykelpass på 300 minuter annars vara
    // 83 procent av veckan.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const lång = träning(plan).find((session) => session.type === 'long');
        if (lång === undefined) continue;

        const andel = lång.minutes / plan.budget.enduranceMinutes;
        expect(andel, `${namn} v${plan.week.index}`).toBeLessThanOrEqual(
          rules.longSession.maxShareOfWeek,
        );
      }
    }
  });

  it('växer genom fasen och når sitt tak i slutet', () => {
    const specifika = buildWeekPlans(P2).filter(
      ({ week }) => week.phase === 'specific' && week.focusRaceId === 'vatternrundan',
    );

    const längder = specifika.map(
      ({ sessions }) => sessions.find((session) => session.type === 'long')?.minutes ?? 0,
    );

    // Aldrig kortare än veckan innan, bortsett från avlastningsveckorna där
    // veckans tid är lägre och därmed taket i R-28 också.
    const utanAvlastning = specifika
      .map((plan, i) => ({ plan, längd: längder[i] as number }))
      .filter(({ plan }) => !plan.week.isDeload)
      .map(({ längd }) => längd);

    for (const [i, längd] of utanAvlastning.entries()) {
      if (i === 0) continue;
      expect(längd, `position ${i}`).toBeGreaterThanOrEqual(utanAvlastning[i - 1] as number);
    }

    expect(utanAvlastning.at(-1)).toBe(rules.longSession.capMinutesBySport.bike);
  });

  it('får långpasset sin del av veckan före de andra passen', () => {
    // Lärdomen från v0: ligger långpasset sist i kön efter styrka och
    // kvalitetspass blir det alltid för kort. Det ska vara det längsta passet
    // i sin egen sport.
    //
    // Jämförelsen är med flit inom sporten och inte över hela veckan: simningens
    // tak är 75 minuter medan cykelns är 300, så ett cykelpass får mycket väl
    // vara längre än simningens långpass.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const lång = träning(plan).find((session) => session.type === 'long');
        if (lång === undefined) continue;

        const sammaSport = träning(plan).filter(
          (session) =>
            session.sport === lång.sport &&
            session.type !== 'long' &&
            session.type !== 'race',
        );
        for (const session of sammaSport) {
          expect(
            lång.minutes,
            `${namn} v${plan.week.index} mot ${session.id}`,
          ).toBeGreaterThanOrEqual(session.minutes);
        }
      }
    }
  });
});

describe('R-15: intensiteten per fas', () => {
  it('ger bara zon 1–2 i återhämtning', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase !== 'recovery') continue;
        for (const session of träning(plan)) {
          if (session.zone === null) continue;
          expect(session.zone, `${namn} v${plan.week.index}`).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it('ger högst ett hårt pass i bas och två i specifik fas', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const hårda = träning(plan).filter(
          (session) => session.zone !== null && session.zone >= 3,
        );
        const tak = rules.intensity.byPhase[plan.week.phase].hardSessionsPerWeek;
        expect(hårda.length, `${namn} v${plan.week.index} ${plan.week.phase}`).toBeLessThanOrEqual(
          tak,
        );
      }
    }
  });

  it('håller fasens högsta zon', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const tak = rules.intensity.byPhase[plan.week.phase].maxZone;
        for (const session of träning(plan)) {
          if (session.zone === null) continue;
          expect(session.zone, `${namn} v${plan.week.index}`).toBeLessThanOrEqual(tak);
        }
      }
    }
  });

  it('ger aldrig zon 4 till den som är ny i sporten', () => {
    // P1 är ny i skidor och simning. Tekniken håller inte för den intensiteten.
    for (const plan of buildWeekPlans(P1)) {
      for (const session of träning(plan)) {
        if (session.sport !== 'ski' && session.sport !== 'swim') continue;
        if (session.zone === null) continue;
        expect(session.zone, `v${plan.week.index} ${session.sport}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('ger zon 4 till den som är erfaren, i specifik fas', () => {
    const harZon4 = buildWeekPlans(P2).some(
      ({ week, sessions }) =>
        week.phase === 'specific' && sessions.some((session) => session.zone === 4),
    );
    expect(harZon4).toBe(true);
  });
});

describe('R-16: hårda pass aldrig två dagar i rad', () => {
  it('håller genom hela planen, över veckogränserna', () => {
    for (const [namn, planer] of alla()) {
      const hårdaDagar = new Set(
        planer.flatMap((plan) =>
          träning(plan)
            .filter((session) => session.zone !== null && session.zone >= 3)
            .map((session) => session.date),
        ),
      );

      for (const datum of hårdaDagar) {
        expect(hårdaDagar.has(addDays(datum, 1)), `${namn}: ${datum} och dagen efter`).toBe(false);
      }
    }
  });
});

describe('R-14: löpning', () => {
  it('ger aldrig löppass två dagar i rad till den som är ny i löpning', () => {
    const nyLöpare: PlanInput = { ...P1, levels: { ...P1.levels, run: 'new' } };

    const löpdagar = new Set(
      buildWeekPlans(nyLöpare).flatMap((plan) =>
        träning(plan)
          .filter((session) => session.sport === 'run' && session.type !== 'race')
          .map((session) => session.date),
      ),
    );

    for (const datum of löpdagar) {
      expect(löpdagar.has(addDays(datum, 1)), `${datum} och dagen efter`).toBe(false);
    }
  });
});

describe('R-04: loppdagen', () => {
  it('innehåller bara loppet', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const loppdagar = träning(plan)
          .filter((session) => session.type === 'race')
          .map((session) => session.date);

        for (const datum of loppdagar) {
          const dagens = träning(plan).filter((session) => session.date === datum);
          expect(dagens.length, `${namn}: ${datum}`).toBe(1);
          expect(dagens[0]?.type, `${namn}: ${datum}`).toBe('race');
        }
      }
    }
  });

  it('ger dagen före loppet högst ett kort öppningspass i zon 1–2', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const lopp of träning(plan).filter((session) => session.type === 'race')) {
          const dagenFöre = addDays(lopp.date, -1);
          const dagens = träning(plan).filter((session) => session.date === dagenFöre);
          if (dagens.length === 0) continue;

          expect(dagens.length, `${namn}: ${dagenFöre}`).toBe(1);
          const öppning = dagens[0] as Session;
          expect(öppning.minutes, `${namn}: ${dagenFöre}`).toBeLessThanOrEqual(30);
          expect(öppning.minutes, `${namn}: ${dagenFöre}`).toBeGreaterThanOrEqual(20);
          expect(öppning.zone as number, `${namn}: ${dagenFöre}`).toBeLessThanOrEqual(2);
          expect(öppning.sport, `${namn}: ${dagenFöre}`).toBe(lopp.sport);
        }
      }
    }
  });

  it('sätter loppets id på lopppasset', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          if (session.type === 'race') {
            expect(session.raceId, `${namn}: ${session.id}`).toBeDefined();
            expect(plan.week.raceIds, `${namn}: ${session.id}`).toContain(session.raceId);
          } else {
            expect(session.raceId, `${namn}: ${session.id}`).toBeUndefined();
          }
        }
      }
    }
  });

  it('ger båda loppen ett eget pass när två går samma vecka (R-27)', () => {
    const sammaVecka: PlanInput = {
      ...P5,
      races: [
        { id: 'vatternrundan', date: '2027-06-18' },
        { id: 'vansbrosimningen', date: '2027-06-20' },
      ],
    };

    const loppveckan = buildWeekPlans(sammaVecka).find((plan) => plan.week.raceIds.length === 2);
    const lopp = träning(loppveckan as WeekPlan).filter((session) => session.type === 'race');

    expect(lopp.length).toBe(2);
    expect(new Set(lopp.map((session) => session.raceId)).size).toBe(2);
  });
});

describe('R-30: titel och instruktion', () => {
  it('ger varje pass en titel och en instruktion', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of träning(plan)) {
          expect(session.title.length, `${namn}: ${session.id} ${session.type}`).toBeGreaterThan(0);
          expect(
            session.instruction.length,
            `${namn}: ${session.id} ${session.type}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('använder den sportspecifika texten där det finns en', () => {
    // Simningens långpass har en egen text: "Långpass i vattnet".
    const simLångpass = buildWeekPlans(P5)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'long' && session.sport === 'swim');

    expect(simLångpass?.title).toBe(sessionTexts.sportVariants['swim.long']?.title);
  });

  it('använder den allmänna texten där ingen variant finns', () => {
    const cykelLångpass = buildWeekPlans(P5)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'long' && session.sport === 'bike');

    expect(cykelLångpass?.title).toBe(sessionTexts.types.long?.title);
  });

  it('har en text för varje passtyp motorn kan skapa', () => {
    const skapade = new Set(
      alla().flatMap(([, planer]) => planer.flatMap((plan) => plan.sessions.map((s) => s.type))),
    );

    for (const typ of skapade) {
      expect(sessionTexts.types[typ], `passtypen ${typ}`).toBeDefined();
    }
  });
});

describe('R-29: veckans tid stämmer', () => {
  it('använder exakt budgetens minuter till planerad träning', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const planerat = träning(plan)
          .filter((session) => session.type !== 'race')
          .reduce((summa, session) => summa + session.minutes, 0);

        // Öppningspasset ligger utanför budgeten, precis som loppet.
        const öppning = plan.budget.raceMinutes > 0 ? rules.raceDay.openerMinutesDayBefore : 0;
        const budget = plan.budget.strengthMinutes + plan.budget.enduranceMinutes;

        expect(planerat - öppning, `${namn} vecka ${plan.week.index}`).toBeLessThanOrEqual(budget);
      }
    }
  });

  it('tappar inga minuter när budgeten räcker till pass', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.budget.raceMinutes > 0) continue;

        const budget = plan.budget.strengthMinutes + plan.budget.enduranceMinutes;
        if (budget < rules.session.minMinutes) continue;

        expect(plan.totalMinutes, `${namn} vecka ${plan.week.index}`).toBe(budget);
      }
    }
  });

  it('visar veckans faktiska tid, loppet inräknat', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const summa = plan.sessions.reduce((a, session) => a + session.minutes, 0);
        expect(plan.totalMinutes, `${namn} vecka ${plan.week.index}`).toBe(summa);
      }
    }
  });
});

describe('passens id', () => {
  it('är unika i hela planen', () => {
    for (const [namn, planer] of alla()) {
      const id = planer.flatMap((plan) => plan.sessions.map((session) => session.id));
      expect(new Set(id).size, namn).toBe(id.length);
    }
  });
});

describe('determinism', () => {
  it('ger samma pass varje gång', () => {
    for (const profil of Object.values(PROFILES)) {
      expect(buildWeekPlans(profil)).toEqual(buildWeekPlans(profil));
    }
  });

  it('ger samma pass oavsett loppens ordning i indatan', () => {
    const baklänges: PlanInput = { ...P6, races: [...P6.races].reverse() };
    expect(buildWeekPlans(baklänges)).toEqual(buildWeekPlans(P6));
  });

  it('ger en plan för varje timtal mellan 3 och 15', () => {
    for (let timmar = 3; timmar <= 15; timmar += 1) {
      const input: PlanInput = { ...P1, hoursPerWeek: timmar };
      const planer = buildWeekPlans(input);
      expect(planer.length, `${timmar} h`).toBeGreaterThan(0);

      for (const plan of planer) {
        for (const session of träning(plan)) {
          if (session.type === 'race') continue;
          expect(session.minutes, `${timmar} h: ${session.id}`).toBeGreaterThanOrEqual(
            rules.session.minMinutes,
          );
        }
      }
    }
  });
});

describe('P3 och P4: de smala planerna', () => {
  it('ger P3 pass trots bara tre timmar i veckan', () => {
    for (const plan of buildWeekPlans(P3)) {
      if (plan.budget.enduranceMinutes < rules.session.minMinutes) continue;
      expect(träning(plan).length, `vecka ${plan.week.index}`).toBeGreaterThan(0);
    }
  });

  it('ger P4 bara skidpass och styrka', () => {
    for (const plan of buildWeekPlans(P4)) {
      for (const session of träning(plan)) {
        expect(['ski', 'strength'], `vecka ${plan.week.index}`).toContain(session.sport);
      }
    }
  });
});

describe('användarens valda dagar', () => {
  /** P1 med andra dagar än de förvalda. */
  function medDagar(longSession: Weekday, rest: Weekday): PlanInput {
    return { ...P1, preferredDays: { longSession, rest } };
  }

  it('håller den valda vilodagen helt fri, varje vecka', () => {
    for (let dag = 1; dag <= 7; dag += 1) {
      const vilodag = dag as Weekday;
      const långpassdag = ((dag % 7) + 1) as Weekday;
      const input = medDagar(långpassdag, vilodag);

      for (const plan of buildWeekPlans(input)) {
        // Loppet och dess öppningspass har fasta dagar och väger tyngre (R-04).
        if (plan.budget.raceMinutes > 0) continue;

        const påVilodagen = träning(plan).filter(
          (session) => weekdayOf(session.date) === vilodag,
        );
        expect(påVilodagen, `vilodag ${vilodag}, vecka ${plan.week.index}`).toEqual([]);
      }
    }
  });

  it('lägger långpasset på den valda dagen, också en vardag', () => {
    for (let dag = 1; dag <= 7; dag += 1) {
      const långpassdag = dag as Weekday;
      const vilodag = ((dag % 7) + 1) as Weekday;
      const input = medDagar(långpassdag, vilodag);

      const långa = buildWeekPlans(input)
        .flatMap((plan) => plan.sessions)
        .filter((session) => session.type === 'long');

      expect(långa.length, `långpassdag ${långpassdag}`).toBeGreaterThan(0);
      for (const session of långa) {
        expect(weekdayOf(session.date), `långpassdag ${långpassdag}`).toBe(långpassdag);
      }
    }
  });

  it('ger fortfarande minst en vilodag i veckan', () => {
    for (let dag = 1; dag <= 7; dag += 1) {
      const input = medDagar(dag as Weekday, (((dag + 2) % 7) + 1) as Weekday);

      for (const plan of buildWeekPlans(input)) {
        const vila = plan.sessions.filter((session) => session.type === 'rest');
        expect(vila.length, `dag ${dag}, vecka ${plan.week.index}`).toBeGreaterThanOrEqual(
          rules.trainingDays.minRestDays,
        );
      }
    }
  });

  it('håller alla andra regler oavsett vilka dagar som valts', () => {
    for (let dag = 1; dag <= 7; dag += 1) {
      const långpassdag = dag as Weekday;
      const vilodag = ((dag % 7) + 1) as Weekday;
      const planer = buildWeekPlans(medDagar(långpassdag, vilodag));

      // R-12: passlängderna håller.
      for (const plan of planer) {
        for (const session of träning(plan)) {
          if (session.type === 'race') continue;
          expect(session.minutes, `dag ${dag}: ${session.id}`).toBeGreaterThanOrEqual(
            rules.session.minMinutes,
          );
        }
      }

      // R-16: aldrig hårda pass två dagar i rad.
      const hårda = new Set(
        planer.flatMap((plan) =>
          träning(plan)
            .filter((session) => session.zone !== null && session.zone >= 3)
            .map((session) => session.date),
        ),
      );
      for (const datum of hårda) {
        expect(hårda.has(addDays(datum, 1)), `dag ${dag}: ${datum}`).toBe(false);
      }
    }
  });

  it('säger till när långpassdagen och vilodagen är samma dag', () => {
    expect(() => buildWeekPlans(medDagar(3, 3))).toThrow(/samma dag/);
  });

  it('flyttar långpasset när den valda dagen är upptagen av loppet', () => {
    // P6 har långpass på onsdag. Ligger ett lopp eller öppningspass där ska
    // planen ändå få sitt långpass, på en annan dag.
    for (const plan of buildWeekPlans(P6)) {
      const lång = träning(plan).find((session) => session.type === 'long');
      if (lång === undefined) continue;

      const upptagna = träning(plan)
        .filter((session) => session.type === 'race')
        .map((session) => session.date);

      expect(upptagna, `vecka ${plan.week.index}`).not.toContain(lång.date);
      expect(weekdayOf(lång.date), `vecka ${plan.week.index}`).not.toBe(P6.preferredDays.rest);
    }
  });

  it('ger P6 sitt långpass på onsdag och fri söndag', () => {
    expect(P6.preferredDays).toEqual({ longSession: 3, rest: 7 });

    const planer = buildWeekPlans(P6);
    const långa = planer.flatMap((plan) => plan.sessions).filter((s) => s.type === 'long');
    expect(långa.length).toBeGreaterThan(0);

    for (const session of långa) {
      expect(weekdayOf(session.date)).toBe(3);
    }
  });
});

describe('reglerna om dagar i rad håller över veckogränsen', () => {
  // Söndag och måndag ligger i olika veckor. Med lördag som vilodag är båda
  // träningsdagar, och då måste reglerna se över gränsen.
  const övergripande: PlanInput = {
    ...P1,
    levels: { ...P1.levels, run: 'new' },
    preferredDays: { longSession: 5, rest: 6 },
  };

  it('ger aldrig två hårda pass i rad, inte heller söndag till måndag (R-16)', () => {
    const planer = buildWeekPlans(övergripande);
    const hårda = new Set(
      planer.flatMap((plan) =>
        träning(plan)
          .filter((session) => session.zone !== null && session.zone >= 3)
          .map((session) => session.date),
      ),
    );

    expect(hårda.size).toBeGreaterThan(0);
    const söndagar = [...hårda].filter((datum) => weekdayOf(datum) === 7);
    expect(söndagar.length).toBeGreaterThan(0);

    for (const datum of hårda) {
      expect(hårda.has(addDays(datum, 1)), `${datum} och dagen efter`).toBe(false);
    }
  });

  it('ger aldrig två löppass i rad till en ny löpare, över gränsen (R-14)', () => {
    const löpdagar = new Set(
      buildWeekPlans(övergripande).flatMap((plan) =>
        träning(plan)
          .filter((session) => session.sport === 'run' && session.type !== 'race')
          .map((session) => session.date),
      ),
    );

    expect(löpdagar.size).toBeGreaterThan(0);
    for (const datum of löpdagar) {
      expect(löpdagar.has(addDays(datum, 1)), `${datum} och dagen efter`).toBe(false);
    }
  });
});
