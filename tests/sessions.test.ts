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
        { id: 'vatternrundan', date: '2027-06-18', goal: 'finish' },
        { id: 'vansbrosimningen', date: '2027-06-20', goal: 'finish' },
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
    // Utomhus: inomhus på trainer finns ingen klunga att ligga i, och då står
    // tipset inte där (R-20). Vätternrundans uppbyggnad ligger ändå i vår och
    // försommar, så långpassen som räknas är ute.
    const cykelLångpass = buildWeekPlans(P2)
      .flatMap((plan) => plan.sessions)
      .find(
        (session) =>
          session.type === 'long' &&
          session.sport === 'bike' &&
          session.substitutedAs === undefined,
      );

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

        // Invarianten i kravspecens avsnitt 9: passen plus den oplacerade
        // tiden är exakt veckans budget. Oplacerad tid uppstår bara när varje
        // gren slagit i ett tak (R-31, R-40) och ska redovisas, inte tystas.
        expect(
          plan.totalMinutes + plan.budget.unplacedMinutes,
          `${namn} vecka ${plan.week.index}`,
        ).toBe(budget);
      }
    }
  });

  it('håller den oplacerade tiden sällsynt och liten', () => {
    // Fältet finns för de veckor där varje gren slagit i ett tak. Blir det en
    // soptunna för minuter motorn tappar har invarianten ovan inget värde
    // längre — därför den här gränsen.
    let medOplacerat = 0;
    let veckor = 0;

    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.budget.raceMinutes > 0) continue;
        veckor += 1;
        if (plan.budget.unplacedMinutes === 0) continue;

        medOplacerat += 1;
        expect(plan.budget.unplacedMinutes, `${namn} v${plan.week.index}`).toBeLessThan(
          rules.session.minMinutes,
        );
      }
    }

    expect(veckor).toBeGreaterThan(0);
    expect(medOplacerat / veckor).toBeLessThan(0.1);
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

  it('håller de lugna dagarna efter ett hårt pass, också över veckogränsen (R-43)', () => {
    const planer = buildWeekPlans(övergripande);

    // Belastning är hårda pass *och* långpasset. Tre tunga dagar i en vecka
    // tömmer depåerna även när de inte ligger i rad.
    const belastning = new Set(
      planer.flatMap((plan) =>
        träning(plan)
          .filter(
            (session) =>
              session.type === 'long' || (session.zone !== null && session.zone >= 3),
          )
          .map((session) => session.date),
      ),
    );

    expect(belastning.size).toBeGreaterThan(0);

    const gap = rules.intensity.minEasyDaysAfterHard;

    // Ligger en belastad dag inom de `gap` första dagarna i sin vecka måste
    // kontrollen se bakåt in i föregående vecka — det är hela poängen med
    // det här testet. Måndagen är styrkedagen (R-42), så gränsfallet kommer
    // via veckans andra dag.
    const tidigtIVeckan = [...belastning].filter((datum) => weekdayOf(datum) <= gap);
    expect(tidigtIVeckan.length).toBeGreaterThan(0);

    for (const datum of belastning) {
      for (let steg = 1; steg <= gap; steg += 1) {
        expect(
          belastning.has(addDays(datum, steg)),
          `${datum} och ${steg} dagar senare`,
        ).toBe(false);
      }
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
    //
    // Undantaget är en vecka vars fokusgren har ett högre golv än taket på
    // hårda minuter: ett simpass är aldrig kortare än sextio minuter (R-40)
    // och ett hårt pass i nedtrappningen aldrig längre än tjugo. Då finns
    // inget hårt pass att lägga, och kvalitetspasset ligger i fokusgrenen
    // eller ingen alls (R-42) — det flyttar inte till cykeln.
    const nedtrappning = buildWeekPlans(P2).filter(({ week, budget }) => {
      if (week.phase !== 'taper' || budget.enduranceMinutes <= TAK * 2) return false;
      if (week.focusRaceId === null) return false;

      const fokus = raceById(week.focusRaceId).sport;
      const golv: Record<string, number> = rules.session.minMinutesBySport;
      return (golv[fokus] ?? rules.session.minMinutes) <= TAK;
    });

    expect(nedtrappning.length).toBeGreaterThan(0);
    for (const plan of nedtrappning) {
      const hårda = träning(plan).filter(
        (session) => session.zone !== null && session.zone >= 3,
      );
      expect(hårda.length, `vecka ${plan.week.index}`).toBe(1);
      expect(hårda[0]?.minutes, `vecka ${plan.week.index}`).toBe(TAK);
    }
  });

  it('flyttar inte nedtrappningens inslag till en annan gren', () => {
    // Före 2026-11-04 hamnade det i cykeln när simningens golv krockade med
    // taket. Kvalitetspasset hör till fokusgrenen, så nu blir det inget pass.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase !== 'taper' || plan.week.focusRaceId === null) continue;

        const fokus = raceById(plan.week.focusRaceId).sport;
        for (const session of träning(plan)) {
          if (session.zone === null || session.zone < 3 || session.type === 'race') continue;
          expect(session.sport, `${namn} v${plan.week.index} ${session.id}`).toBe(fokus);
        }
      }
    }
  });

  it('tappar inga minuter när ett hårt pass kapas', () => {
    // Tiden ska flytta till lugna pass, inte försvinna ur veckan.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase !== 'taper' || plan.budget.raceMinutes > 0) continue;

        const budget = plan.budget.strengthMinutes + plan.budget.enduranceMinutes;
        if (budget < rules.session.minMinutes) continue;

        // Invarianten i kravspecens avsnitt 9: passen plus den oplacerade
        // tiden är exakt veckans budget. Oplacerad tid uppstår bara när varje
        // gren slagit i ett tak (R-31, R-40) och ska redovisas, inte tystas.
        expect(
          plan.totalMinutes + plan.budget.unplacedMinutes,
          `${namn} vecka ${plan.week.index}`,
        ).toBe(budget);
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

        // Invarianten i kravspecens avsnitt 9: passen plus den oplacerade
        // tiden är exakt veckans budget. Oplacerad tid uppstår bara när varje
        // gren slagit i ett tak (R-31, R-40) och ska redovisas, inte tystas.
        expect(
          plan.totalMinutes + plan.budget.unplacedMinutes,
          `${namn} vecka ${plan.week.index}`,
        ).toBe(budget);
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

  it('ger P3 riktig simträning när simningen väl börjat', () => {
    // P3 simmade noll minuter innan rotationen gjordes om. Simningen börjar
    // nu senare (R-39), men när den väl börjar ska passen vara riktiga pass.
    const simpass = buildWeekPlans(P3)
      .flatMap((plan) => träning(plan))
      .filter((session) => session.sport === 'swim' && session.type !== 'race');

    expect(simpass.length).toBeGreaterThan(5);
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
      races: [{ id: 'vatternrundan', date: '2027-05-08', goal: 'finish' }],
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

  it('erbjuder inte skidor till den som varken har snö eller något att åka på', () => {
    // Cykel erbjuds alltid: alla som gör en klassiker har cykel. Skidor kräver
    // snö — alltså vintern — eller rullskidor eller stakmaskin.
    const vinter = rules.season.winterMonths;

    for (const session of buildWeekPlans(P1).flatMap((plan) => plan.sessions)) {
      const grenar = session.alternatives.map((a) => a.sport);
      if (vinter.includes(Number(session.date.slice(5, 7)))) continue;

      expect(grenar, `${session.id} ${session.date}`).not.toContain('ski');
    }
  });

  it('erbjuder skidor till den som har stakmaskin men ingen snö', () => {
    // Minst en av grenens flaggor räcker.
    const medStakmaskin: PlanInput = {
      ...P2,
      equipment: { snow: false, rollerSkis: false, skiErg: true, indoorTrainer: true },
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

describe('R-40: golv per gren', () => {
  const GOLV = rules.session.minMinutesBySport.swim;
  const TAK = rules.session.maxMinutesBySport.swim;

  /**
   * Öppningspasset dagen före loppet, som golvet inte gäller.
   *
   * Det är kort med flit och ligger på loppets plats, inte i simhallen — det
   * är inte en resa för tjugo minuters träning.
   */
  function ärÖppningspass(session: Session, plan: WeekPlan): boolean {
    return plan.sessions.some(
      (kandidat) =>
        kandidat.type === 'race' &&
        kandidat.sport === session.sport &&
        kandidat.date === addDays(session.date, 1),
    );
  }

  it('är satt i konfigurationen, inte i koden', () => {
    expect(GOLV).toBeGreaterThan(rules.session.minMinutes);
    expect(TAK).toBeLessThan(rules.session.maxMinutes);
    expect(TAK).toBeGreaterThan(GOLV);
    expect(rules.session._minMinutesBySport).toContain('simhallen');
    expect(rules.session._maxMinutesBySport).toContain('R-40');
  });

  it('ger aldrig ett simpass längre än nittio minuter', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of träning(plan)) {
          if (session.sport !== 'swim' || session.type === 'race') continue;

          expect(session.minutes, `${namn} v${plan.week.index} ${session.id}`).toBeLessThanOrEqual(
            TAK,
          );
        }
      }
    }
  });

  it('delar upp simningen i fler pass i stället för att göra ett för långt', () => {
    // P2 jagar tid i Vansbrosimningen och får veckor med mer simtid än ett
    // pass rymmer. Då ska det bli två pass, inte ett på nästan två timmar.
    const veckor = buildWeekPlans(P2).filter(
      (plan) =>
        träning(plan).filter((session) => session.sport === 'swim' && session.type !== 'race')
          .length >= 2,
    );

    expect(veckor.length).toBeGreaterThan(0);
    for (const plan of veckor) {
      for (const session of träning(plan)) {
        if (session.sport !== 'swim' || session.type === 'race') continue;
        if (ärÖppningspass(session, plan)) continue;

        expect(session.minutes, `v${plan.week.index}`).toBeGreaterThanOrEqual(GOLV);
        expect(session.minutes, `v${plan.week.index}`).toBeLessThanOrEqual(TAK);
      }
    }
  });

  it('ger aldrig ett simpass kortare än en timme', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const session of träning(plan)) {
          if (session.sport !== 'swim' || session.type === 'race') continue;
          if (ärÖppningspass(session, plan)) continue;

          expect(session.minutes, `${namn} v${plan.week.index} ${session.id}`).toBeGreaterThanOrEqual(
            GOLV,
          );
        }
      }
    }
  });

  it('gäller också långpasset', () => {
    // En plan med bara Vansbrosimningen. I de fyra loppens plan ligger
    // Vätternrundan tre veckor före Vansbro, så Vansbro får aldrig egna
    // specifika veckor (R-03) och därmed inget simlångpass att pröva.
    const baraVansbro: PlanInput = {
      schemaVersion: 5,
      today: '2026-11-02',
      startDate: '2026-11-02',
      races: [{ id: 'vansbrosimningen', date: '2027-07-10', goal: 'time' }],
      levels: { swim: 'experienced' },
      hoursPerWeek: 6,
      preferredDays: { longSession: 6 as Weekday, rest: 1 as Weekday },
      equipment: { snow: false, rollerSkis: false, skiErg: false, indoorTrainer: false },
    };

    const långpass = buildWeekPlans(baraVansbro)
      .flatMap((plan) => träning(plan))
      .filter((session) => session.type === 'long');

    // Finns inget simlångpass har testet inte prövat det det säger.
    expect(långpass.length).toBeGreaterThan(0);
    for (const session of långpass) {
      expect(session.sport).toBe('swim');
      expect(session.minutes, session.id).toBeGreaterThanOrEqual(GOLV);
    }
  });

  it('låter veckan stå utan simning hellre än att ge ett kort pass', () => {
    // P3 har tre timmar i veckan. Där räcker simningens andel sällan till en
    // hel timme, och då simmar hon inte den veckan — minuterna går till en
    // annan gren i stället för att bli en resa till simhallen för tjugo
    // minuter.
    const planer = buildWeekPlans(P3);
    const utan = planer.filter(
      (plan) => !träning(plan).some((session) => session.sport === 'swim'),
    );

    expect(utan.length).toBeGreaterThan(0);

    // Men minuterna försvinner inte ur veckan (R-29). Loppet och
    // öppningspasset ligger utanför budgeten (R-04, R-25) och räknas inte.
    for (const plan of utan) {
      const planerat = träning(plan)
        .filter((session) => session.type !== 'race' && !ärÖppningspass(session, plan))
        .reduce((summa, session) => summa + session.minutes, 0);

      expect(planerat + plan.budget.unplacedMinutes, `v${plan.week.index}`).toBe(
        plan.budget.enduranceMinutes + plan.budget.strengthMinutes,
      );
    }
  });

  it('ger nybörjaren sin timme i vattnet varje vecka, också när långpasset är stort', () => {
    // R-31 och R-40 tillsammans: nybörjarkursen är en timme i veckan, och
    // långpasset ska lämna plats för den. Simning går inte att komma ikapp.
    // Undantaget är de sista veckorna före Vasaloppet, där allt är skidor
    // (R-45). Simningen pausas då, och grenen har noll minuter att lägga.
    const veckor = buildWeekPlans(P1).filter(
      ({ budget }) => budget.enduranceMinutes > 0 && (budget.bySport.swim ?? 0) > 0,
    );

    expect(veckor.length).toBeGreaterThan(0);
    for (const plan of veckor) {
      const sim = träning(plan).filter(
        (session) => session.sport === 'swim' && session.type !== 'race',
      );
      const öppningspass = sim.filter((session) => ärÖppningspass(session, plan));

      expect(sim.length, `v${plan.week.index}`).toBeGreaterThanOrEqual(1);
      for (const session of sim) {
        if (öppningspass.includes(session)) continue;
        expect(session.minutes, `v${plan.week.index}`).toBeGreaterThanOrEqual(GOLV);
      }
    }
  });

  it('ger simningen hela pass under uppbyggnaden mot Vansbrosimningen', () => {
    // R-39 låter den erfarna simmaren börja sent. Börjar hon då ska det bli
    // riktiga pass, inte tjugo minuter i veckan — annars har uppbyggnaden
    // inget innehåll.
    const vansbro = raceById('vansbrosimningen');
    const planer = buildWeekPlans(P3);
    const lopp = planer.find((plan) => plan.week.raceIds.includes('vansbrosimningen'));

    expect(lopp).toBeDefined();
    expect(vansbro.sport).toBe('swim');

    const uppbyggnad = planer.filter(
      (plan) =>
        plan.week.index < (lopp?.week.index ?? 0) &&
        plan.week.index >= (lopp?.week.index ?? 0) - 6 &&
        plan.budget.enduranceMinutes > 0,
    );

    const sim = uppbyggnad.flatMap((plan) =>
      träning(plan).filter((session) => session.sport === 'swim' && session.type !== 'race'),
    );

    expect(sim.length).toBeGreaterThan(0);
  });

  it('flyttar nedtrappningens hårda inslag ur vattnet i stället för att korta passet', () => {
    // R-15 ger nedtrappningen högst tjugo hårda minuter. I simning finns inget
    // sådant pass, så inslaget läggs i en annan gren — men det ska finnas kvar.
    const tak = rules.intensity.byPhase.taper.maxHardMinutes;

    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.phase !== 'taper') continue;

        for (const session of träning(plan)) {
          if (session.zone === null || session.zone < 3) continue;

          expect(session.sport, `${namn} ${session.id}`).not.toBe('swim');
          expect(session.minutes, `${namn} ${session.id}`).toBeLessThanOrEqual(tak);
        }
      }
    }
  });
});


describe('R-42: en dag styrka, en dag långpass, en dag intervaller', () => {
  const STYRKA = rules.strength.minutesPerSession;

  /** Passen per dag, vila oräknad. */
  function perDag(plan: WeekPlan): Map<string, Session[]> {
    const karta = new Map<string, Session[]>();

    for (const session of träning(plan)) {
      const rad = karta.get(session.date) ?? [];
      rad.push(session);
      karta.set(session.date, rad);
    }

    return karta;
  }

  it('har talen i konfigurationen, inte i koden', () => {
    expect(STYRKA).toBe(60);
    expect(rules.strength.ownDay).toBe(true);
    expect(rules.strength.sessionsByPhase.base).toBe(1);
    expect(rules.strength.sessionsByPhase.specific).toBe(1);
    expect(rules.intensity.byPhase.specific.hardSessionsPerWeek).toBe(1);
  });

  it('ger aldrig en dag mer än ett pass', () => {
    // Appen är byggd för folk med jobb. Två pass samma dag förutsätter att man
    // kan träna två gånger, och tre pass på en tisdag är inget program.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const [datum, dagens] of perDag(plan)) {
          expect(dagens.length, `${namn} ${datum}: ${dagens.map((s) => s.id).join(', ')}`).toBe(1);
        }
      }
    }
  });

  it('lägger styrkepasset ensamt på sin dag, en hel timme', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        for (const [datum, dagens] of perDag(plan)) {
          const styrka = dagens.filter((session) => session.sport === 'strength');
          if (styrka.length === 0) continue;

          expect(dagens.length, `${namn} ${datum}`).toBe(1);
          expect(styrka[0]?.minutes, `${namn} ${datum}`).toBe(STYRKA);
        }
      }
    }
  });

  it('ger ett styrkepass i veckan i bas och specifik fas, inget i nedtrappning', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.budget.strengthMinutes === 0) continue;

        const styrka = träning(plan).filter((session) => session.sport === 'strength');
        const väntat = rules.strength.sessionsByPhase[plan.week.phase];

        expect(styrka.length, `${namn} v${plan.week.index} ${plan.week.phase}`).toBe(väntat);
      }
    }
  });

  it('gör långpasset till veckans längsta pass', () => {
    // Lärdomen från v0: ligger långpasset sist i kön blir det alltid för
    // kort, och med ett pass per dag kapar dess längd dessutom alla andra.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const lång = träning(plan).find((session) => session.type === 'long');
        if (lång === undefined) continue;

        for (const session of träning(plan)) {
          if (session.type === 'race' || session.sport === 'strength') continue;

          expect(lång.minutes, `${namn} v${plan.week.index} mot ${session.id}`).toBeGreaterThanOrEqual(
            session.minutes,
          );
        }
      }
    }
  });

  it('lägger varje kvalitetspass i veckans fokusgren', () => {
    // Det är regeln: veckan handlar om ett lopp, och kvalitetspasset tränar
    // mot det loppet. Före 2026-11-04 flyttade passet till en gren som hade en
    // plats ledig, och då låg intervallerna på cykel i en vecka som var
    // loppspecifik mot Lidingöloppet.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        if (plan.week.focusRaceId === null) continue;
        const fokus = raceById(plan.week.focusRaceId).sport;

        for (const session of träning(plan)) {
          if (session.zone === null || session.zone < 3 || session.type === 'race') continue;
          expect(session.sport, `${namn} v${plan.week.index} ${session.id}`).toBe(fokus);
        }
      }
    }
  });

  it('ger veckan ett kvalitetspass när fokusgrenen har plats till det', () => {
    // Priset för regeln ovan: räcker fokusgrenens tid inte till både
    // teknikpass och kvalitetspass får veckan inget kvalitetspass — teknik går
    // före, den går inte att komma ikapp på slutet (R-21).
    //
    // P2 har tio timmar och plats till båda i stort sett varje vecka. De
    // tunnare profilerna prövas på regeln, inte på frekvensen.
    let med = 0;
    let borde = 0;

    for (const plan of buildWeekPlans(P2)) {
      const fas = rules.intensity.byPhase[plan.week.phase];
      if (fas.hardSessionsPerWeek === 0) continue;
      if (plan.week.raceIds.length > 0 || plan.budget.enduranceMinutes === 0) continue;

      borde += 1;
      if (träning(plan).some((session) => session.zone !== null && session.zone >= 3)) med += 1;
    }

    expect(borde).toBeGreaterThan(0);
    expect(med / borde, `P2: ${med} av ${borde}`).toBeGreaterThanOrEqual(0.95);
  });

  it('ger aldrig fler pass än veckan har träningsdagar', () => {
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const dagar = new Set(träning(plan).map((session) => session.date));
        const vila = plan.sessions.filter((session) => session.type === 'rest').length;

        expect(dagar.size + vila, `${namn} v${plan.week.index}`).toBe(7);
      }
    }
  });
});

describe('R-43: två lugna dagar efter ett hårt pass', () => {
  const GAP = rules.intensity.minEasyDaysAfterHard;

  /** Dagar som bär belastning: ett hårt pass eller långpasset. */
  function belastade(planer: readonly WeekPlan[]): Set<string> {
    return new Set(
      planer.flatMap((plan) =>
        träning(plan)
          .filter(
            (session) =>
              session.type !== 'race' &&
              (session.type === 'long' || (session.zone !== null && session.zone >= 3)),
          )
          .map((session) => session.date),
      ),
    );
  }

  it('har talet i konfigurationen', () => {
    expect(GAP).toBe(2);
    expect(rules.intensity._minEasyDaysAfterHard).toContain('Långpasset');
  });

  it('lägger aldrig två belastade dagar närmare än två dagar isär', () => {
    // Tränargranskningen: hårda pass på onsdag, fredag och söndag ligger inte
    // i rad, men tre tunga dagar i en vecka tömmer depåerna ändå.
    for (const [namn, planer] of alla()) {
      const dagar = belastade(planer);
      expect(dagar.size, namn).toBeGreaterThan(0);

      for (const datum of dagar) {
        for (let steg = 1; steg <= GAP; steg += 1) {
          expect(dagar.has(addDays(datum, steg)), `${namn}: ${datum} + ${steg} dagar`).toBe(false);
        }
      }
    }
  });

  it('ger veckan högst två belastade dagar', () => {
    // Ett hårt pass och ett långpass. Fler ryms inte med två lugna dagar
    // emellan, och det är hela poängen.
    for (const [namn, planer] of alla()) {
      for (const plan of planer) {
        const dagar = träning(plan).filter(
          (session) =>
            session.type !== 'race' &&
            (session.type === 'long' || (session.zone !== null && session.zone >= 3)),
        );

        expect(dagar.length, `${namn} v${plan.week.index}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('R-44: taket för ett ersättningspass', () => {
  /**
   * Bor i Skåne: har stakmaskin men inga rullskidor, och kommer inte åt snö.
   *
   * Då ersätts Vasaloppets egna långpass, och de är de längsta i planen — det
   * är där taket på nittio minuter betyder något.
   */
  const skåne: PlanInput = {
    ...P2,
    equipment: { snow: false, rollerSkis: false, skiErg: true, indoorTrainer: true },
  };

  const TAK = 90;

  function stakpass(): Session[] {
    return buildWeekPlans(skåne)
      .flatMap((plan) => träning(plan))
      .filter((session) => session.substitutedAs === 'ski.skiErg');
  }

  it('har taket i konfigurationen', () => {
    const stak = rules.substitutions.bySport.ski?.find((rad) => rad.key === 'ski.skiErg');

    expect(stak?.maxMinutes).toBe(TAK);
    expect(stak?.overflowKey).toBe('ski.poleWalk');
  });

  it('delar passet när det är längre än taket', () => {
    const långa = stakpass().filter((session) => session.minutes > TAK);
    expect(långa.length).toBeGreaterThan(0);

    for (const session of långa) {
      expect(session.instruction, session.id).toContain('högst 90 minuter');
      expect(session.instruction, session.id).toContain('stavgång i backe');
      expect(session.instruction, session.id).toContain(String(session.minutes - TAK));
    }
  });

  it('säger ingenting om delning när passet ryms under taket', () => {
    const korta = stakpass().filter((session) => session.minutes <= TAK);
    expect(korta.length).toBeGreaterThan(0);

    for (const session of korta) {
      expect(session.instruction, session.id).not.toContain('högst 90 minuter');
    }
  });

  it('behåller passets tid — skidträningen försvinner inte', () => {
    // Passet görs på två sätt, men det är ett pass och tiden är oförändrad.
    // Ett andra pass samma dag vore precis vad R-42 förbjuder.
    for (const plan of buildWeekPlans(skåne)) {
      const dagar = new Set(träning(plan).map((session) => session.date));
      expect(dagar.size, `v${plan.week.index}`).toBe(träning(plan).length);
    }
  });

  it('har inga ersättningsmarkörer kvar i texten', () => {
    for (const session of stakpass()) {
      expect(session.instruction, session.id).not.toMatch(/\{\w+\}/);
    }
  });
});


describe('R-46: långpasset trappas upp varje vecka', () => {
  /** Långpassen i ordning, med veckan och fasen de hör till. */
  function långpass(input: PlanInput) {
    return buildWeekPlans(input)
      .map((plan) => ({ plan, lång: träning(plan).find((session) => session.type === 'long') }))
      .filter((rad) => rad.lång !== undefined);
  }

  /** Par av långpass i samma fas, där inget av dem är en avlastningsvecka. */
  function påFöljande(input: PlanInput) {
    const rader = långpass(input);
    const par = [];

    for (let i = 1; i < rader.length; i += 1) {
      const a = rader[i - 1] as (typeof rader)[number];
      const b = rader[i] as (typeof rader)[number];

      if (a.plan.week.phaseId !== b.plan.week.phaseId) continue;
      if (a.plan.week.isDeload || b.plan.week.isDeload) continue;
      if (a.lång?.sport !== b.lång?.sport) continue;

      par.push({ a, b });
    }

    return par;
  }

  it('låter långpasset aldrig krympa inom en fas', () => {
    // Trappas det upp ska det gå uppåt. En vecka som går bakåt mitt i en
    // uppbyggnad är en plan som inte går att lita på.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const par = påFöljande(profil);
      expect(par.length, namn).toBeGreaterThan(0);

      for (const { a, b } of par) {
        expect(
          b.lång?.minutes,
          `${namn} v${a.plan.week.index}→v${b.plan.week.index} ${a.lång?.sport}`,
        ).toBeGreaterThanOrEqual(a.lång?.minutes as number);
      }
    }
  });

  it('låter löpningens långpass växa högst femton procent i veckan', () => {
    // Löpning sliter mest, och det är där upptrappningen betyder något.
    // Före 2026-11-04 låg långpasset mot Lidingöloppet på 75 minuter fyra
    // veckor i rad och hoppade sedan till 122 — sextiotre procent.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { a, b } of påFöljande(profil)) {
        if (a.lång?.sport !== 'run') continue;

        const ökning = ((b.lång?.minutes as number) - (a.lång?.minutes as number)) /
          (a.lång?.minutes as number);

        expect(
          ökning,
          `${namn} v${a.plan.week.index}→v${b.plan.week.index}: ${a.lång?.minutes} → ${b.lång?.minutes}`,
        ).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('ligger aldrig stilla fyra veckor i rad och hoppar sedan', () => {
    // Det var formen felet hade: platt, platt, platt, platt, hopp.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const rader = långpass(profil);

      for (let i = 4; i < rader.length; i += 1) {
        const fönster = rader.slice(i - 4, i + 1);
        const sammaFas = fönster.every(
          (rad) => rad.plan.week.phaseId === fönster[0]?.plan.week.phaseId,
        );
        if (!sammaFas) continue;

        const längder = fönster.map((rad) => rad.lång?.minutes as number);
        const platta = längder.slice(0, 4).every((m) => m === längder[0]);
        if (!platta) continue;

        // Fyra lika veckor får följas av högst en liten ökning.
        const sista = längder[4] as number;
        expect(
          (sista - (längder[0] as number)) / (längder[0] as number),
          `${namn} v${fönster[0]?.plan.week.index}: ${längder.join(' → ')}`,
        ).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it('når grenens tak före loppet', () => {
    // Upptrappningen ska komma hela vägen fram, inte stanna halvvägs.
    const tak = rules.longSession.capMinutesBySport;

    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const race of profil.races) {
        const sport = raceById(race.id).sport;
        if (sport === 'swim') continue;

        const längsta = Math.max(
          0,
          ...långpass(profil)
            .filter((rad) => rad.lång?.sport === sport && rad.plan.week.startDate < race.date)
            .map((rad) => rad.lång?.minutes as number),
        );

        if (längsta === 0) continue;

        // Två tak gäller: grenens eget i R-13 och sjuttio procent av veckans
        // konditionstid i R-28. Det senare binder för den som har sex timmar
        // i veckan — ett långpass på fem timmar ryms inte i en sextimmarsvecka
        // hur bra upptrappningen än är.
        const störstaVecka = Math.max(
          ...buildWeekPlans(profil).map(({ budget }) => budget.enduranceMinutes),
        );
        const nåbart = Math.min(
          tak[sport as 'run'],
          Math.floor(störstaVecka * rules.longSession.maxShareOfWeek),
        );

        // P4 har sex veckor på sig och kommer inte fram; de övriga ska.
        const andel = namn === 'P4' ? 0.6 : 0.85;
        expect(längsta / nåbart, `${namn} ${race.id}`).toBeGreaterThanOrEqual(andel);
      }
    }
  });

  it('erbjuder cykel som alternativ till löpningens långpass', () => {
    // Din poäng: man kan cykla i stället för att springa. Det sliter mindre.
    const löplångpass = Object.values(PROFILES).flatMap((profil) =>
      långpass(profil).filter((rad) => rad.lång?.sport === 'run'),
    );

    expect(löplångpass.length).toBeGreaterThan(0);
    for (const rad of löplångpass) {
      const cykel = rad.lång?.alternatives.find((alternativ) => alternativ.sport === 'bike');
      expect(cykel, `v${rad.plan.week.index}`).toBeDefined();
    }
  });
});
