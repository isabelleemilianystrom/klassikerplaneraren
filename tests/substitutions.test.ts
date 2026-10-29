import { describe, expect, it } from 'vitest';
import { rules, sessions as sessionTexts } from '../src/engine/config.ts';
import { monthOf } from '../src/engine/dates.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { courseAdvice } from '../src/engine/warnings.ts';
import type { PlanInput, Session } from '../src/engine/types.ts';
import { P1, P2, P3, P4, PROFILES } from './profiles.ts';

/** Alla pass i en profil, vila undantagen. */
function pass(input: PlanInput): Session[] {
  return buildWeekPlans(input)
    .flatMap((plan) => plan.sessions)
    .filter((session) => session.type !== 'rest');
}

function allaPass(): [string, Session[]][] {
  return Object.entries(PROFILES).map(([namn, profil]) => [namn, pass(profil)]);
}

const ÖPPET_VATTEN = rules.season.openWaterMonths;

describe('R-17: skidor utan snö eller rullskidor', () => {
  it('ger stavgång i backe åt den som inte har något', () => {
    // P4 har ingen utrustning alls. Bor man där det inte finns snö är stavgång
    // i backe hur man tränar för Vasaloppet — det är bra träning, inte en
    // nödlösning.
    const skidpass = pass(P4).filter((s) => s.sport === 'ski' && s.type !== 'race');

    expect(skidpass.length).toBeGreaterThan(0);
    for (const session of skidpass) {
      expect(session.substitutedAs, session.id).toBe('ski.poleWalk');
      expect(session.title).toBe(sessionTexts.substitutes['ski.poleWalk']?.title);
    }
  });

  it('ger stakmaskin före stavgång när användaren har en', () => {
    const medStakmaskin: PlanInput = {
      ...P4,
      equipment: { snowOrRollerSkis: false, skiErg: true, pool: false, bike: false },
    };

    const skidpass = pass(medStakmaskin).filter((s) => s.sport === 'ski' && s.type !== 'race');

    expect(skidpass.length).toBeGreaterThan(0);
    for (const session of skidpass) {
      expect(session.substitutedAs, session.id).toBe('ski.skiErg');
    }
  });

  it('rör inte skidpassen för den som har snö eller rullskidor', () => {
    for (const session of pass(P2)) {
      if (session.sport !== 'ski') continue;
      expect(session.substitutedAs, session.id).toBeUndefined();
    }
  });

  it('behåller grenen också när passet görs på ett annat sätt', () => {
    // Passet tränar fortfarande mot Vasaloppet, och det ska synas.
    for (const session of pass(P4)) {
      if (session.substitutedAs !== 'ski.poleWalk') continue;
      expect(session.sport, session.id).toBe('ski');
    }
  });
});

describe('R-18 och R-19: simning utan simhall', () => {
  it('ger torrövningar utanför öppet vatten-säsongen', () => {
    const simpass = pass(P3).filter(
      (s) =>
        s.sport === 'swim' && s.type !== 'race' && !ÖPPET_VATTEN.includes(monthOf(s.date)),
    );

    expect(simpass.length).toBeGreaterThan(0);
    for (const session of simpass) {
      expect(session.substitutedAs, `${session.id} ${session.date}`).toBe('swim.dryland');
    }
  });

  it('kräver ingen simhall i öppet vatten juni till augusti', () => {
    const sommarsim = pass(P3).filter(
      (s) => s.sport === 'swim' && s.type !== 'race' && ÖPPET_VATTEN.includes(monthOf(s.date)),
    );

    expect(sommarsim.length).toBeGreaterThan(0);
    for (const session of sommarsim) {
      expect(session.substitutedAs, session.id).toBeUndefined();
    }
  });

  it('rör inte simpassen för den som har simhall', () => {
    for (const session of pass(P1)) {
      if (session.sport !== 'swim') continue;
      expect(session.substitutedAs, session.id).toBeUndefined();
    }
  });
});

describe('R-20: cykel utan cykel', () => {
  it('ger spinning', () => {
    const utanCykel: PlanInput = {
      ...P2,
      equipment: { snowOrRollerSkis: true, skiErg: true, pool: true, bike: false },
    };

    const cykelpass = pass(utanCykel).filter((s) => s.sport === 'bike' && s.type !== 'race');

    expect(cykelpass.length).toBeGreaterThan(0);
    for (const session of cykelpass) {
      expect(session.substitutedAs, session.id).toBe('bike.indoor');
      expect(session.title).toBe(sessionTexts.substitutes['bike.indoor']?.title);
    }
  });
});

describe('ersättningarna i stort', () => {
  it('ersätter aldrig loppet', () => {
    // Den som anmält sig till Vasaloppet åker Vasaloppet, utrustning eller ej.
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.type !== 'race') continue;
        expect(session.substitutedAs, `${namn} ${session.id}`).toBeUndefined();
      }
    }
  });

  it('behåller tid och zon', () => {
    // R-17: "med samma tid och samma zon".
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.substitutedAs === undefined) continue;

        expect(session.minutes, `${namn} ${session.id}`).toBeGreaterThanOrEqual(
          rules.session.minMinutes,
        );
        expect(session.zone, `${namn} ${session.id}`).not.toBeNull();
      }
    }
  });

  it('ger inga alternativ till ett ersatt pass', () => {
    // Ersättningen är redan ett byte. Tre sätt att göra samma pass är ett för
    // många.
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.substitutedAs === undefined) continue;
        expect(session.alternatives, `${namn} ${session.id}`).toEqual([]);
      }
    }
  });

  it('ger varje ersatt pass en titel och en instruktion', () => {
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.substitutedAs === undefined) continue;

        const text = sessionTexts.substitutes[session.substitutedAs];
        expect(text, `${namn} ${session.substitutedAs}`).toBeDefined();
        expect(session.title).toBe(text?.title);
        expect(session.instruction).toBe(text?.instruction);
      }
    }
  });

  it('gör alla sex profiler genomförbara', () => {
    // Före regeln fick P3 skid- och simpass utan utrustning, och P4 skidpass
    // utan skidor. Nu ska inget pass kräva något användaren inte har.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const utrustning = profil.equipment as unknown as Record<string, boolean>;

      for (const session of pass(profil)) {
        if (session.sport === null || session.type === 'race') continue;
        if (session.substitutedAs !== undefined) continue;
        if (ÖPPET_VATTEN.includes(monthOf(session.date)) && session.sport === 'swim') continue;

        const krav = rules.substitutions.requiredEquipment[session.sport];
        if (krav === undefined) continue;

        expect(
          krav.some((flagga) => utrustning[flagga] === true),
          `${namn} ${session.id} ${session.sport} ${session.date}`,
        ).toBe(true);
      }
    }
  });
});

describe('R-19: säkerhetstexten för öppet vatten', () => {
  it('finns på varje simpass juni till augusti', () => {
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.sport !== 'swim') continue;
        if (!ÖPPET_VATTEN.includes(monthOf(session.date))) continue;
        if (session.substitutedAs !== undefined) continue;

        expect(session.safetyNote, `${namn} ${session.id} ${session.date}`).toBe(
          sessionTexts.safetyNotes.openWater.text,
        );
      }
    }
  });

  it('finns inte utanför juni till augusti', () => {
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (ÖPPET_VATTEN.includes(monthOf(session.date))) continue;
        expect(session.safetyNote, `${namn} ${session.id}`).toBeUndefined();
      }
    }
  });

  it('finns bara på simpass', () => {
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.safetyNote === undefined) continue;
        expect(session.sport, `${namn} ${session.id}`).toBe('swim');
      }
    }
  });

  it('är ordagrant texten från avsnitt 8', () => {
    const medNot = allaPass()
      .flatMap(([, sessions]) => sessions)
      .find((session) => session.safetyNote !== undefined);

    expect(medNot?.safetyNote).toBe(sessionTexts.safetyNotes.openWater.text);
    expect(medNot?.safetyNote).toMatch(/Simma aldrig ensam/);
  });
});

describe('R-21: teknik och kurs för nybörjaren', () => {
  it('ger teknikpass i de allra flesta veckorna i en nybörjargren', () => {
    // P1 är ny i skidor och simning.
    const veckor = buildWeekPlans(P1).filter(
      ({ week, budget }) =>
        (week.phase === 'base' || week.phase === 'specific') && budget.enduranceMinutes > 0,
    );

    const medTeknik = veckor.filter((plan) =>
      plan.sessions.some((session) => session.type === 'technique'),
    );

    expect(medTeknik.length / veckor.length).toBeGreaterThan(0.8);
  });

  it('ger inga teknikpass i bas eller specifik fas till den som är van', () => {
    // P2 är erfaren. Teknikpassen i P2 kommer från R-33, alltså bara under
    // återhämtningen.
    for (const plan of buildWeekPlans(P2)) {
      if (plan.week.phase === 'recovery') continue;

      const teknik = plan.sessions.filter((session) => session.type === 'technique');
      expect(teknik, `vecka ${plan.week.index}`).toEqual([]);
    }
  });

  it('ger kursrekommendation för varje nybörjargren i planen', () => {
    const råd = courseAdvice(P1);

    expect(råd.length).toBe(2);
    expect(råd.join(' ')).toMatch(/skidkurs/);
    expect(råd.join(' ')).toMatch(/simkurs|lektioner/);
  });

  it('ger inget råd för en gren vars lopp inte ingår', () => {
    // P4 är ny i skidor och har bara Vasaloppet. Ett simråd vore bara brus.
    const råd = courseAdvice(P4);

    expect(råd.length).toBe(1);
    expect(råd[0]).toMatch(/längdskidor/i);
  });

  it('ger inget råd till den som är van', () => {
    expect(courseAdvice(P2)).toEqual([]);
  });
});

describe('R-30: lopptaktik på loppdagen', () => {
  it('lägger till taktiken på varje lopppass', () => {
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.type !== 'race') continue;

        const taktik = sessionTexts.raceNotes.byRace[session.raceId as 'vasaloppet'];
        expect(taktik, `${namn} ${session.id}`).toBeDefined();
        expect(session.instruction, `${namn} ${session.id}`).toContain(taktik as string);
      }
    }
  });

  it('nämner motströmmen i Vansbrosimningen', () => {
    const lopp = pass(P1).find(
      (s) => s.type === 'race' && s.raceId === 'vansbrosimningen',
    );

    expect(lopp?.instruction).toMatch(/motströms/);
    expect(lopp?.instruction).toMatch(/Vanån/);
  });

  it('nämner klungan i Vätternrundan och sista milen i Lidingöloppet', () => {
    const sessions = pass(P2);

    expect(
      sessions.find((s) => s.raceId === 'vatternrundan')?.instruction,
    ).toMatch(/klunga/);
    expect(
      sessions.find((s) => s.raceId === 'lidingoloppet')?.instruction,
    ).toMatch(/sista milen/);
  });

  it('sätter ingen taktik på andra pass än loppet', () => {
    const taktiker = Object.values(sessionTexts.raceNotes.byRace);

    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.type === 'race') continue;

        for (const taktik of taktiker) {
          expect(session.instruction, `${namn} ${session.id}`).not.toContain(taktik);
        }
      }
    }
  });

  it('behåller den allmänna lopptexten före taktiken', () => {
    const lopp = pass(P1).find((s) => s.type === 'race');
    expect(lopp?.instruction).toMatch(/^I dag är det lopp\./);
  });
});

describe('tränargranskningen 2026-10-29', () => {
  it('nämner utförsbackarna i löpningens långpass', () => {
    // Coachen: de flesta övar bara uppför, men det är nedför låren tar emot.
    const långpass = pass(P2).find((s) => s.type === 'long' && s.sport === 'run');

    expect(långpass?.instruction).toMatch(/utförsbackar/);
    expect(långpass?.instruction).toMatch(/låren/);
  });

  it('nämner blicklyft i simningens pass', () => {
    // Coachen: i en älv finns ingen linje i botten att följa.
    const simpass = pass(P1).filter(
      (s) => s.sport === 'swim' && (s.type === 'long' || s.type === 'technique'),
    );

    expect(simpass.length).toBeGreaterThan(0);
    for (const session of simpass) {
      expect(session.instruction, session.id).toMatch(/blicken/);
    }
  });
});
