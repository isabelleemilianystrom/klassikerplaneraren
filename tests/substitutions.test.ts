import { describe, expect, it } from 'vitest';
import { rules, sessions as sessionTexts } from '../src/engine/config.ts';
import { monthOf } from '../src/engine/dates.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { courseAdvice } from '../src/engine/warnings.ts';
import type { PlanInput, Session } from '../src/engine/types.ts';
import { P1, P2, P3, P4, P5, P6, PROFILES } from './profiles.ts';

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

describe('R-17: skidor utanför vintern', () => {
  const VINTER = rules.season.winterMonths;

  /** Skidpassen utanför vintern, där det inte finns snö att åka på. */
  function utanSnö(input: PlanInput) {
    return pass(input).filter(
      (s) => s.sport === 'ski' && s.type !== 'race' && !VINTER.includes(monthOf(s.date)),
    );
  }

  it('rör inte skidpassen under vintern — då finns det snö', () => {
    // Snö är det enda som begränsar skidträningen, och snö är en fråga om
    // månaden. Under season.winterMonths åker alla skidor, oavsett vad de äger.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const session of pass(profil)) {
        if (session.sport !== 'ski' || session.type === 'race') continue;
        if (!VINTER.includes(monthOf(session.date))) continue;

        expect(session.substitutedAs, `${namn} ${session.id} ${session.date}`).toBeUndefined();
      }
    }
  });

  it('ger stavgång i backe åt den som inte har något komplement', () => {
    // P1 har inga komplement och planen går över ett helt år. P4 duger inte
    // här: dess sex veckor ligger helt i november–december, alltså i vintern.
    const skidpass = utanSnö(P1);

    expect(skidpass.length).toBeGreaterThan(0);
    for (const session of skidpass) {
      expect(session.substitutedAs, session.id).toBe('ski.poleWalk');
      expect(session.title).toBe(sessionTexts.substitutes['ski.poleWalk']?.title);
    }
  });

  it('ger rullskidor före stakmaskin och stavgång', () => {
    // Rullskidor ligger närmast snö: tekniken är densamma. P6 har dem och
    // ingen stakmaskin.
    const skidpass = utanSnö(P6);

    expect(skidpass.length).toBeGreaterThan(0);
    for (const session of skidpass) {
      expect(session.substitutedAs, session.id).toBe('ski.rollerSkis');
    }
  });

  it('ger stakmaskin före stavgång när användaren har en men inga rullskidor', () => {
    const medStakmaskin: PlanInput = {
      ...P1,
      equipment: { rollerSkis: false, skiErg: true, indoorTrainer: false },
    };

    const skidpass = utanSnö(medStakmaskin);

    expect(skidpass.length).toBeGreaterThan(0);
    for (const session of skidpass) {
      expect(session.substitutedAs, session.id).toBe('ski.skiErg');
    }
  });

  it('väljer rullskidor framför stakmaskin när användaren har båda', () => {
    const skidpass = utanSnö(P2);

    expect(skidpass.length).toBeGreaterThan(0);
    for (const session of skidpass) {
      expect(session.substitutedAs, session.id).toBe('ski.rollerSkis');
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

describe('R-18 borttagen: simpass ersätts aldrig', () => {
  it('ersätter inte simpass för den som saknar simhall, någon månad', () => {
    // P3 har bara cykel. Före 2026-11-04 blev hennes simpass torrövningar med
    // gummiband, och två av dem hamnade i zon 4 — rubriken sa hårda
    // intervaller och instruktionen beskrev rörlighetsträning.
    //
    // Nu planeras simpass som simpass. Kan man inte simma behöver man lära sig
    // det i en simhall, och saknas den är det användarens sak att lösa.
    const simpass = pass(P3).filter((s) => s.sport === 'swim' && s.type !== 'race');

    expect(simpass.length).toBeGreaterThan(0);
    for (const session of simpass) {
      expect(session.substitutedAs, `${session.id} ${session.date}`).toBeUndefined();
    }
  });

  it('ersätter inte simpass för någon av profilerna, med eller utan simhall', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const session of pass(profil)) {
        if (session.sport !== 'swim') continue;
        expect(session.substitutedAs, `${namn} ${session.id}`).toBeUndefined();
      }
    }
  });

  it('låter inget ersatt pass motsäga sin egen instruktion', () => {
    // Det var det som gjorde torrövningarna fel: ett hårt pass blev
    // rörlighetsträning men behöll zon 4. De ersättningar som finns kvar är
    // likvärdig träning — stavgång i backe i zon 4 är riktigt backarbete, och
    // spinning i zon 4 är riktiga intervaller.
    const likvärdiga = ['ski.rollerSkis', 'ski.skiErg', 'ski.poleWalk', 'bike.indoor'];

    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const session of pass(profil)) {
        if (session.substitutedAs === undefined) continue;
        if (session.zone === null || session.zone < 3) continue;

        expect(likvärdiga, `${namn} ${session.id}`).toContain(session.substitutedAs);
      }
    }
  });
});

describe('R-20: cykel inomhus på vintern', () => {
  const VINTER = rules.season.winterMonths;

  function cykelpass(input: PlanInput) {
    return pass(input).filter((s) => s.sport === 'bike' && s.type !== 'race');
  }

  it('lägger vinterns cykelpass inomhus för den som har en trainer', () => {
    // P5 jagar tid på cykeln och har en trainer. Det är svårt att cykla
    // landsväg i januari, och då är tiden i sadeln lättare att styra inomhus.
    const vinter = cykelpass(P5).filter((s) => VINTER.includes(monthOf(s.date)));

    expect(vinter.length).toBeGreaterThan(0);
    for (const session of vinter) {
      expect(session.substitutedAs, `${session.id} ${session.date}`).toBe('bike.indoor');
      expect(session.title).toBe(sessionTexts.substitutes['bike.indoor']?.title);
    }
  });

  it('lämnar sommarens cykelpass ute, också för den som har trainer', () => {
    const sommar = cykelpass(P5).filter((s) => !VINTER.includes(monthOf(s.date)));

    expect(sommar.length).toBeGreaterThan(0);
    for (const session of sommar) {
      expect(session.substitutedAs, `${session.id} ${session.date}`).toBeUndefined();
    }
  });

  it('ersätter inte cykelpasset för den som saknar trainer', () => {
    // Alla som gör en klassiker har cykel, så det finns inget att ersätta.
    // Saknas trainern planeras passet som vanligt cykelpass — året om.
    for (const session of cykelpass(P3)) {
      expect(session.substitutedAs, `${session.id} ${session.date}`).toBeUndefined();
    }
  });

  it('behåller grenen när passet görs inomhus', () => {
    for (const session of pass(P5)) {
      if (session.substitutedAs !== 'bike.indoor') continue;
      expect(session.sport, session.id).toBe('bike');
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

  it('ger inga alternativ till ett pass som bytt gren', () => {
    // En riktig ersättning är redan ett byte. Tre sätt att göra samma pass är
    // ett för många.
    for (const [namn, sessions] of allaPass()) {
      for (const session of sessions) {
        if (session.substitutedAs === undefined) continue;
        if (!session.substitutedAs.startsWith('ski.')) continue;

        expect(session.alternatives, `${namn} ${session.id}`).toEqual([]);
      }
    }
  });

  it('behåller alternativen när passet bara bytt plats (R-20)', () => {
    // Ett cykelpass inomhus är fortfarande ett cykelpass. Alternativen till
    // det är lika giltiga som ute, och att sudda dem vore att straffa den som
    // har en trainer.
    const inomhus = pass(P5).filter((s) => s.substitutedAs === 'bike.indoor');

    expect(inomhus.length).toBeGreaterThan(0);
    expect(inomhus.some((s) => s.alternatives.length > 0)).toBe(true);

    for (const session of inomhus) {
      expect(session.sport, session.id).toBe('bike');
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
    const VINTER = rules.season.winterMonths;

    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const session of pass(profil)) {
        if (session.sport === null || session.type === 'race') continue;
        if (session.substitutedAs !== undefined) continue;

        // Ett skidpass som inte är ersatt måste ligga i vintern — snö är det
        // enda som gör skidpasset görbart som det är.
        const snögren: readonly string[] = rules.substitutions.snowSports;
        if (!snögren.includes(session.sport)) continue;

        expect(
          VINTER.includes(monthOf(session.date)),
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
