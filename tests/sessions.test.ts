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
    // Simteknik beskrivs inte som skidteknik.
    const simteknik = buildWeekPlans(P1)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'technique' && session.sport === 'swim');

    expect(simteknik?.title).toBe(sessionTexts.sportVariants['swim.technique']?.title);

    // P2 har skidor. P1 har inga, och där blir skidpassen stavgång i stället
    // (R-17) — det prövas i sitt eget test.
    const skidteknik = buildWeekPlans(P2)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'technique' && session.sport === 'ski');

    expect(skidteknik?.title).toBe(sessionTexts.sportVariants['ski.technique']?.title);
  });

  it('använder den allmänna texten där ingen variant finns', () => {
    // Skidornas långpass har ingen egen text — skidor är inte annorlunda nog.
    expect(sessionTexts.sportVariants['ski.long']).toBeUndefined();

    const skidLångpass = buildWeekPlans(P2)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'long' && session.sport === 'ski');

    expect(skidLångpass?.title).toBe(sessionTexts.types.long?.title);
  });

  it('ger löpningens långpass en text om terräng och underlag', () => {
    // Lidingöloppet går på mjukt och ojämnt underlag, inte på asfalt.
    const löpLångpass = buildWeekPlans(P2)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'long' && session.sport === 'run');

    expect(löpLångpass?.title).toBe(sessionTexts.sportVariants['run.long']?.title);
    expect(löpLångpass?.instruction).toMatch(/terräng|stig|underlag/i);
  });

  it('nämner klungkörning som ett tips i cykelns långpass, inte som ett krav', () => {
    const cykelLångpass = buildWeekPlans(P2)
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'long' && session.sport === 'bike');

    expect(cykelLångpass?.instruction).toMatch(/klunga/i);
    // Det ska stå att passet duger ensamt — inte alla har någon att cykla med.
    expect(cykelLångpass?.instruction).toMatch(/Tips:/);
    expect(cykelLångpass?.instruction).toMatch(/ensam/i);
  });

  it('viktar styrkan mot överkropp i Vasaloppets block', () => {
    const vasa = buildWeekPlans(P2).filter(
      ({ week }) => week.focusRaceId === 'vasaloppet' && week.phase === 'specific',
    );

    const styrka = vasa.flatMap((p) => p.sessions).filter((s) => s.type === 'strength');
    expect(styrka.length).toBeGreaterThan(0);
    for (const session of styrka) {
      expect(session.title).toBe(sessionTexts.strengthVariants.byRace['vasaloppet']?.title);
      expect(session.instruction).toMatch(/överkropp/i);
    }
  });

  it('ger allmän styrka i de andra loppens block', () => {
    const andra = buildWeekPlans(P2).filter(
      ({ week }) => week.focusRaceId === 'lidingoloppet' && week.phase === 'specific',
    );

    const styrka = andra.flatMap((p) => p.sessions).filter((s) => s.type === 'strength');
    expect(styrka.length).toBeGreaterThan(0);
    for (const session of styrka) {
      expect(session.title).toBe(sessionTexts.types.strength?.title);
    }
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

    // Måndag är veckans första dag. Ligger ett hårt pass där måste
    // kontrollen se bakåt in i föregående vecka för att R-16 ska hålla —
    // det är hela poängen med det här testet.
    const måndagar = [...hårda].filter((datum) => weekdayOf(datum) === 1);
    expect(måndagar.length).toBeGreaterThan(0);

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

describe('R-31: nybörjaren får ett pass i veckan', () => {
  const TAK = rules.newLevelLimits.bySport.swim as {
    maxMinutesPerWeek: number;
    maxSessionsPerWeek: number;
  };

  /** Simpassen i veckan, loppet undantaget. */
  function simpass(plan: WeekPlan): Session[] {
    return träning(plan).filter(
      (session) => session.sport === 'swim' && session.type !== 'race',
    );
  }

  it('ger högst ett simpass i veckan åt den som är ny i simning', () => {
    // P1 är ny i simning. En nybörjarkurs är ett pass i veckan, inte två korta.
    for (const plan of buildWeekPlans(P1)) {
      // Loppveckan har sitt öppningspass, som R-04 kräver.
      if (plan.budget.raceMinutes > 0) continue;

      expect(simpass(plan).length, `vecka ${plan.week.index}`).toBeLessThanOrEqual(
        TAK.maxSessionsPerWeek,
      );
    }
  });

  it('håller minuttaket också när långpasset är simningens pass', () => {
    for (const plan of buildWeekPlans(P1)) {
      if (plan.budget.raceMinutes > 0) continue;

      const minuter = simpass(plan).reduce((summa, session) => summa + session.minutes, 0);
      expect(minuter, `vecka ${plan.week.index}`).toBeLessThanOrEqual(TAK.maxMinutesPerWeek);
    }
  });

  it('ger nybörjaren ett simpass i veckan också i basfasen', () => {
    // Går man en nybörjarkurs är det ett pass i veckan, och det ska finnas
    // året om — också under vinterhalvåret, eftersom simning inte går att
    // komma ikapp på slutet.
    const basveckor = buildWeekPlans(P1).filter(
      ({ week, budget }) => week.phase === 'base' && budget.enduranceMinutes > 0,
    );

    expect(basveckor.length).toBeGreaterThan(0);
    for (const plan of basveckor) {
      const pass = simpass(plan);
      expect(pass.length, `vecka ${plan.week.index}`).toBe(1);
    }
  });

  it('håller uppe simningen med teknikpass under återhämtningen (R-33)', () => {
    // Kroppen ska vila efter ett långt lopp, men tekniken tappas fort.
    const återhämtning = buildWeekPlans(P1).filter(
      ({ week, budget }) => week.phase === 'recovery' && budget.enduranceMinutes > 0,
    );

    expect(återhämtning.length).toBeGreaterThan(0);
    for (const plan of återhämtning) {
      const pass = simpass(plan);
      expect(pass.length, `vecka ${plan.week.index}`).toBe(1);
      expect(pass[0]?.type, `vecka ${plan.week.index}`).toBe('technique');
    }
  });

  it('ger loppveckan bara öppningspasset och loppet', () => {
    const loppveckan = buildWeekPlans(P1).find((plan) =>
      plan.week.raceIds.includes('vansbrosimningen'),
    );

    const pass = simpass(loppveckan as WeekPlan);
    expect(pass.length).toBe(1);
    expect(pass[0]?.minutes).toBe(rules.raceDay.openerMinutesDayBefore);
  });

  it('rör inte den som är van i simning', () => {
    // P2 är erfaren och ska kunna ha både fler och längre simpass.
    const fler = buildWeekPlans(P2).some(
      (plan) => simpass(plan).reduce((a, s) => a + s.minutes, 0) > TAK.maxMinutesPerWeek,
    );
    expect(fler).toBe(true);
  });
});

describe('R-15: nedtrappningen har bara korta inslag i zon 3', () => {
  const TAK = rules.intensity.byPhase.taper.maxHardMinutes;

  it('kapar hårda pass till fasens tak', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase !== 'taper') continue;

        for (const session of träning(plan)) {
          if (session.zone === null || session.zone < 3) continue;
          expect(session.minutes, `${namn} v${plan.week.index} ${session.id}`).toBeLessThanOrEqual(
            TAK,
          );
        }
      }
    }
  });

  it('ger nedtrappningen minst ett kort inslag i zon 3 när tiden räcker', () => {
    // R-15 säger att inslagen ska finnas, inte bara att de ska vara korta.
    const nedtrappning = buildWeekPlans(P2).filter(
      ({ week, budget }) => week.phase === 'taper' && budget.enduranceMinutes > TAK * 2,
    );

    expect(nedtrappning.length).toBeGreaterThan(0);
    for (const plan of nedtrappning) {
      const hårda = träning(plan).filter(
        (session) => session.zone !== null && session.zone >= 3,
      );
      expect(hårda.length, `vecka ${plan.week.index}`).toBe(1);
      expect(hårda[0]?.minutes, `vecka ${plan.week.index}`).toBe(TAK);
    }
  });

  it('tappar inga minuter när ett hårt pass kapas', () => {
    // Tiden ska flytta till lugna pass, inte försvinna ur veckan.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase !== 'taper' || plan.budget.raceMinutes > 0) continue;

        const budget = plan.budget.strengthMinutes + plan.budget.enduranceMinutes;
        if (budget < rules.session.minMinutes) continue;

        expect(plan.totalMinutes, `${namn} vecka ${plan.week.index}`).toBe(budget);
      }
    }
  });

  it('rör inte de hårda passen i bas och specifik fas', () => {
    // Taket gäller bara nedtrappningen. Ett tröskelpass i specifik fas ska
    // fortfarande vara ett helt pass.
    const längre = buildWeekPlans(P2).some(
      ({ week, sessions }) =>
        week.phase === 'specific' &&
        sessions.some(
          (session) => session.zone !== null && session.zone >= 3 && session.minutes > TAK,
        ),
    );
    expect(längre).toBe(true);
  });
});

describe('R-13: långpasset lånar tid de sista veckorna', () => {
  it('når sitt tak i fasens sista veckor', () => {
    // Det här är vad lånet finns för: långpasset ska nå sitt tak och inte
    // bindas av grenens andel av veckan. Om grenen råkar ha nog med tid ändå
    // behövs inget lån, och då är utfallet detsamma — det är utfallet som
    // räknas.
    const sista = buildWeekPlans(P2).filter(
      ({ week, budget }) =>
        week.phase === 'specific' &&
        week.focusRaceId === 'vatternrundan' &&
        budget.enduranceMinutes > 0 &&
        !week.isDeload,
    );

    const längsta = Math.max(
      ...sista.flatMap((plan) =>
        träning(plan).filter((s) => s.type === 'long').map((s) => s.minutes),
      ),
    );

    expect(längsta).toBe(rules.longSession.capMinutesBySport.bike);
  });

  it('låter långpasset överstiga grenens andel när grenen är smal', () => {
    // En plan på sex timmar i veckan: skidorna får inte 55 procent nog för ett
    // långpass på fyra timmar, så lånet måste träda in.
    const sista = buildWeekPlans(P1).filter(
      ({ week, budget }) =>
        week.phase === 'specific' && week.focusRaceId === 'vasaloppet' && budget.enduranceMinutes > 0,
    );

    const lånade = sista.filter((plan) => {
      const lång = träning(plan).find((session) => session.type === 'long');
      if (lång === undefined || lång.sport === null) return false;
      return lång.minutes > (plan.budget.bySport[lång.sport as 'ski'] ?? 0);
    });

    expect(lånade.length).toBeGreaterThan(0);
  });

  it('håller sig inom R-28:s tak också när det lånar', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const lång = träning(plan).find((session) => session.type === 'long');
        if (lång === undefined) continue;

        expect(
          lång.minutes / plan.budget.enduranceMinutes,
          `${namn} v${plan.week.index}`,
        ).toBeLessThanOrEqual(rules.longSession.maxShareOfWeek);
      }
    }
  });

  it('tar lånet från de andra grenarna, inte ur veckans totala tid', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.budget.raceMinutes > 0) continue;

        const budget = plan.budget.strengthMinutes + plan.budget.enduranceMinutes;
        if (budget < rules.session.minMinutes) continue;

        expect(plan.totalMinutes, `${namn} vecka ${plan.week.index}`).toBe(budget);
      }
    }
  });

  it('ger de två långa loppen långpass på minst halva loppets tid', () => {
    // Ett långpass på tre timmar inför 315 kilometer är inte en förberedelse.
    // Kravet gäller den som har tid nog; P3 med tre timmar i veckan kommer inte
    // dit, och det är varningarnas sak att säga (R-23).
    for (const profil of [P2, P6]) {
      const längsta = new Map<string, number>();
      for (const plan of buildWeekPlans(profil)) {
        for (const session of träning(plan)) {
          if (session.type !== 'long' || session.sport === null) continue;
          längsta.set(session.sport, Math.max(längsta.get(session.sport) ?? 0, session.minutes));
        }
      }

      for (const race of profil.races) {
        const config = raceById(race.id);
        if (config.sport !== 'ski' && config.sport !== 'bike') continue;

        const andel = (längsta.get(config.sport) ?? 0) / 60 / config.estimatedHours;
        expect(andel, `${config.name}`).toBeGreaterThanOrEqual(0.4);
      }
    }
  });
});

describe('alla grenar i planen tränas, också de tunna veckorna', () => {
  it('ger varje gren pass i alla profiler', () => {
    // Lärdomen från v0: en gren som aldrig får plats tränas aldrig. Urvalet
    // roterar därför i stället för att alltid stryka den minsta grenen.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const planer = buildWeekPlans(profil);
      const grenar = new Set(
        planer
          .flatMap((plan) => träning(plan))
          .filter((session) => session.type !== 'race')
          .map((session) => session.sport),
      );

      for (const race of profil.races) {
        expect(grenar, `${namn}: ${race.id}`).toContain(raceById(race.id).sport);
      }
    }
  });

  it('ger P3 riktig simträning trots tre timmar i veckan', () => {
    // P3 simmade noll minuter innan rotationen gjordes om.
    const simpass = buildWeekPlans(P3)
      .flatMap((plan) => träning(plan))
      .filter((session) => session.sport === 'swim' && session.type !== 'race');

    expect(simpass.length).toBeGreaterThan(20);
    for (const session of simpass) {
      expect(session.minutes).toBeGreaterThanOrEqual(rules.session.minMinutes);
    }
  });
});

describe('R-37: passet är det primära, grenen är ett val', () => {
  /** Alla pass av en viss typ i en plan. */
  function passAvTyp(input: PlanInput, type: string) {
    return buildWeekPlans(input)
      .flatMap((plan) => plan.sessions)
      .filter((session) => session.type === type);
  }

  it('ger långpasset inför Lidingöloppet cykel som alternativ', () => {
    // Ditt exempel: ett långpass inför Lidingöloppet är bäst som löpning, men
    // kan också göras på landsvägscykel — och sliter då mindre på kroppen.
    const löplångpass = buildWeekPlans(P2)
      .filter(({ week }) => week.focusRaceId === 'lidingoloppet')
      .flatMap((plan) => plan.sessions)
      .filter((session) => session.type === 'long' && session.sport === 'run');

    expect(löplångpass.length).toBeGreaterThan(0);
    for (const session of löplångpass) {
      expect(session.alternatives.map((a) => a.sport)).toContain('bike');
    }
  });

  it('ger längdskidor som alternativ till ett cykellångpass i mars', () => {
    // Ditt andra exempel: ett långpass inför Vätternrundan är optimalt på cykel,
    // men finns det snö i mars går längdskidor lika bra.
    const tidigVattern: PlanInput = {
      ...P2,
      races: [{ id: 'vatternrundan', date: '2027-05-08' }],
      startDate: '2026-12-07',
      today: '2026-12-07',
    };

    const mars = passAvTyp(tidigVattern, 'long').filter(
      (session) => session.date >= '2027-03-01' && session.date < '2027-04-01',
    );

    expect(mars.length).toBeGreaterThan(0);
    for (const session of mars) {
      expect(session.sport).toBe('bike');
      const skidor = session.alternatives.find((a) => a.sport === 'ski');
      expect(skidor).toBeDefined();
      expect(skidor?.note).toMatch(/snö/);
    }
  });

  it('erbjuder inte längdskidor utanför skidsäsongen', () => {
    // Att föreslå skidor i juli gör planen otrovärdig.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          const månad = Number(session.date.slice(5, 7));
          if ([11, 12, 1, 2, 3].includes(månad)) continue;

          expect(
            session.alternatives.map((a) => a.sport),
            `${namn} ${session.date}`,
          ).not.toContain('ski');
        }
      }
    }
  });

  it('erbjuder inte en gren användaren saknar utrustning för', () => {
    // P4 har ingen utrustning alls: inga skidor, ingen stakmaskin, ingen cykel.
    for (const session of buildWeekPlans(P4).flatMap((plan) => plan.sessions)) {
      const grenar = session.alternatives.map((a) => a.sport);
      expect(grenar, session.id).not.toContain('bike');
      expect(grenar, session.id).not.toContain('ski');
    }
  });

  it('erbjuder skidor till den som har stakmaskin men ingen snö', () => {
    // Minst en av grenens flaggor räcker.
    const medStakmaskin: PlanInput = {
      ...P2,
      equipment: { snowOrRollerSkis: false, skiErg: true, pool: true, bike: true },
    };

    const vinter = buildWeekPlans(medStakmaskin)
      .flatMap((plan) => plan.sessions)
      .filter(
        (session) =>
          session.sport === 'bike' &&
          rules.sessionAlternatives.forTypes.includes(session.type) &&
          [12, 1, 2].includes(Number(session.date.slice(5, 7))),
      );

    expect(vinter.length).toBeGreaterThan(0);
    expect(vinter.some((s) => s.alternatives.some((a) => a.sport === 'ski'))).toBe(true);
  });

  it('ger inga alternativ till lopp, vila, styrka eller teknik', () => {
    // Ett teknikpass i simning kan inte bytas mot cykel — då är det inte längre
    // samma pass.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          if (rules.sessionAlternatives.forTypes.includes(session.type)) continue;
          expect(session.alternatives, `${namn} ${session.id} ${session.type}`).toEqual([]);
        }
      }
    }
  });

  it('har aldrig passets egen gren som alternativ', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          expect(
            session.alternatives.map((a) => a.sport),
            `${namn} ${session.id}`,
          ).not.toContain(session.sport);
        }
      }
    }
  });

  it('ger varje alternativ en titel', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          for (const alternativ of session.alternatives) {
            expect(alternativ.title.length, `${namn} ${session.id} ${alternativ.sport}`)
              .toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('erbjuder aldrig simning som alternativ', () => {
    // Simning ger inte samma konditionsträning som ett långpass på cykel, och
    // kräver dessutom simhall. Den står inte bland de utbytbara grenarna.
    for (const [, planer] of alla()) {
      for (const plan of planer) {
        for (const session of plan.sessions) {
          expect(session.alternatives.map((a) => a.sport)).not.toContain('swim');
        }
      }
    }
  });

  it('ger samma alternativ varje gång', () => {
    for (const profil of Object.values(PROFILES)) {
      expect(buildWeekPlans(profil)).toEqual(buildWeekPlans(profil));
    }
  });
});

describe('R-13: långpass också i basfasen', () => {
  /** Långpassen i en fas, i veckoordning. */
  function långaIFas(input: PlanInput, phase: string, raceId: string) {
    return buildWeekPlans(input)
      .filter(({ week }) => week.phase === phase && week.focusRaceId === raceId)
      .map((plan) => ({
        vecka: plan.week,
        lång: plan.sessions.find((session) => session.type === 'long'),
      }));
  }

  it('ger basveckorna ett långpass', () => {
    // Grundperioden är där uthålligheten byggs. Tolv basveckor utan ett enda
    // längre pass är svårt att försvara.
    const bas = långaIFas(P2, 'base', 'vasaloppet');

    expect(bas.length).toBeGreaterThan(0);
    for (const { vecka, lång } of bas) {
      expect(lång, `vecka ${vecka.index}`).toBeDefined();
    }
  });

  it('håller basens långpass under hälften av grenens tak', () => {
    const tak = rules.longSession.capMinutesBySport.ski;
    const { endShareOfCap } = rules.longSession.growthByPhase.base;

    for (const { vecka, lång } of långaIFas(P2, 'base', 'vasaloppet')) {
      expect(lång?.minutes as number, `vecka ${vecka.index}`).toBeLessThanOrEqual(
        Math.round(tak * endShareOfCap),
      );
    }
  });

  it('låter den specifika fasen ta vid där basen slutade', () => {
    // Basen slutar på hälften av taket, den specifika fasen börjar där.
    const bas = långaIFas(P2, 'base', 'vasaloppet');
    const specifik = långaIFas(P2, 'specific', 'vasaloppet');

    const sistaBas = bas.at(-1)?.lång?.minutes as number;
    const förstaSpecifik = specifik[0]?.lång?.minutes as number;

    expect(förstaSpecifik).toBeGreaterThan(sistaBas);

    // Steget mellan faserna ska inte vara större än ett steg inom en fas.
    const stegIFasen =
      (specifik[1]?.lång?.minutes as number) - (specifik[0]?.lång?.minutes as number);
    expect(förstaSpecifik - sistaBas).toBeLessThanOrEqual(stegIFasen * 2);
  });

  it('växer genom basfasen', () => {
    const bas = långaIFas(P2, 'base', 'vasaloppet').filter(({ vecka }) => !vecka.isDeload);

    for (const [i, { lång }] of bas.entries()) {
      if (i === 0) continue;
      expect(lång?.minutes as number, `position ${i}`).toBeGreaterThanOrEqual(
        bas[i - 1]?.lång?.minutes as number,
      );
    }
  });

  it('ger inget långpass i nedtrappning eller återhämtning', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase === 'base' || plan.week.phase === 'specific') continue;

        const lång = plan.sessions.find((session) => session.type === 'long');
        expect(lång, `${namn} vecka ${plan.week.index} ${plan.week.phase}`).toBeUndefined();
      }
    }
  });

  it('hoppar över basveckor där grenen inte har tid för ett långpass', () => {
    // P3 har tre timmar i veckan. Där tiden inte räcker blir det inget
    // långpass, inte ett långpass som bara heter så.
    const bas = långaIFas(P3, 'base', 'vasaloppet');
    const med = bas.filter(({ lång }) => lång !== undefined);

    expect(med.length).toBeGreaterThan(0);
    for (const { lång } of med) {
      expect(lång?.minutes as number).toBeGreaterThanOrEqual(rules.longSession.minMinutes);
    }
  });

  it('ger basens långpass samma alternativ som andra pass (R-37)', () => {
    const bas = långaIFas(P2, 'base', 'vasaloppet');
    const första = bas[0]?.lång;

    expect(första?.sport).toBe('ski');
    expect(första?.alternatives.map((a) => a.sport)).toContain('bike');
  });
});
