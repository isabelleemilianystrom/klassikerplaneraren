import { describe, expect, it } from 'vitest';
import { sportsInPlan, weekBudgets } from '../src/engine/budget';
import { raceById, rules } from '../src/engine/config';
import { buildWeeks } from '../src/engine/weeks';
import type { PlanInput, TrainedSport } from '../src/engine/types';
import { P1, P2, P3, P4, P5, P6, PROFILES } from './profiles';

/** Veckorna och deras budgetar parvis — testerna behöver nästan alltid båda. */
function veckorMedBudget(input: PlanInput) {
  const veckor = buildWeeks(input);
  const budgetar = weekBudgets(input);
  return veckor.map((vecka, i) => ({ vecka, budget: budgetar[i] as (typeof budgetar)[number] }));
}

function summaAvSporter(bySport: Partial<Record<TrainedSport, number>>): number {
  return Object.values(bySport).reduce((a, b) => a + b, 0);
}

describe('R-05: fasens andel av veckotiden', () => {
  const T = P2.hoursPerWeek * 60;

  it('ger bas 75 procent, specifik 100 och återhämtning 50', () => {
    for (const { vecka, budget } of veckorMedBudget(P2)) {
      // Avlastningsveckor och planens två första veckor har egna regler.
      if (vecka.isDeload || vecka.index <= rules.weekTime.firstWeeks.count) continue;
      if (vecka.phase === 'taper') continue;

      const förväntat = Math.round(T * rules.weekTime.phaseShare[vecka.phase]);
      expect(budget.phaseMinutes, `vecka ${vecka.index} ${vecka.phase}`).toBe(förväntat);
    }
  });

  it('trappar ner 60 procent första veckan och 40 den andra', () => {
    const vasa = veckorMedBudget(P2).filter(
      ({ vecka }) => vecka.phase === 'taper' && vecka.focusRaceId === 'vasaloppet',
    );

    // Vasaloppet har två nedtrappningsveckor.
    expect(vasa.length).toBe(2);
    expect(vasa[0]?.budget.phaseMinutes).toBe(Math.round(T * 0.6));
    expect(vasa[1]?.budget.phaseMinutes).toBe(Math.round(T * 0.4));
  });

  it('ger 50 procent när nedtrappningen bara är en vecka', () => {
    const lidingö = veckorMedBudget(P2).filter(
      ({ vecka }) => vecka.phase === 'taper' && vecka.focusRaceId === 'lidingoloppet',
    );

    expect(lidingö.length).toBe(1);
    expect(lidingö[0]?.budget.phaseMinutes).toBe(Math.round(T * 0.5));
  });

  it('håller sig inom fasens tid i alla profiler', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const T = profil.hoursPerWeek * 60;
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        // Specifik fas är 100 procent av T och är därmed taket.
        expect(budget.phaseMinutes, `${namn} vecka ${vecka.index}`).toBeLessThanOrEqual(T);
        expect(budget.phaseMinutes, `${namn} vecka ${vecka.index}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('R-06: avlastningsveckan', () => {
  it('ger 70 procent av fasens tid', () => {
    const T = P2.hoursPerWeek * 60;

    for (const { vecka, budget } of veckorMedBudget(P2)) {
      if (!vecka.isDeload) continue;
      if (vecka.index <= rules.weekTime.firstWeeks.count) continue;

      const fasensTid = T * rules.weekTime.phaseShare[vecka.phase as 'base' | 'specific'];
      expect(budget.phaseMinutes, `vecka ${vecka.index}`).toBe(
        Math.round(fasensTid * rules.weekTime.deload.share),
      );
    }
  });

  it('gör avlastningsveckan lättare än veckan före', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const rader = veckorMedBudget(profil);
      for (const [i, { vecka, budget }] of rader.entries()) {
        const före = rader[i - 1];
        if (!vecka.isDeload || före === undefined) continue;
        if (före.vecka.phase !== vecka.phase) continue;
        if (vecka.index <= rules.weekTime.firstWeeks.count) continue;

        expect(budget.phaseMinutes, `${namn} vecka ${vecka.index}`).toBeLessThan(
          före.budget.phaseMinutes,
        );
      }
    }
  });
});

describe('R-07: planens två första veckor', () => {
  it('ger högst 60 procent av T', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const tak = Math.round(profil.hoursPerWeek * 60 * rules.weekTime.firstWeeks.maxShare);

      for (const { vecka, budget } of veckorMedBudget(profil)) {
        if (vecka.index > rules.weekTime.firstWeeks.count) continue;
        expect(budget.phaseMinutes, `${namn} vecka ${vecka.index}`).toBeLessThanOrEqual(tak);
      }
    }
  });

  it('är ett tak och inte en andel, så en lättare fas inte höjs', () => {
    // P4 startar sex veckor före Vasaloppet. Veckorna 1–2 ligger i specifik
    // fas, som är 100 procent av T, och ska därför kapas till 60 procent.
    const första = veckorMedBudget(P4)[0];
    expect(första?.budget.phaseMinutes).toBe(Math.round(P4.hoursPerWeek * 60 * 0.6));
  });
});

describe('R-25: loppet räknas som belastning', () => {
  it('räknar av loppets uppskattade tid från veckans budget', () => {
    for (const { vecka, budget } of veckorMedBudget(P2)) {
      const förväntat = vecka.raceIds.reduce(
        (summa, id) => summa + Math.round(raceById(id).estimatedHours * 60),
        0,
      );
      expect(budget.raceMinutes, `vecka ${vecka.index}`).toBe(förväntat);
    }
  });

  it('planerar ingen träning ovanpå nio mil skidor', () => {
    // Vasaloppet tar sju timmar. Loppveckan är nedtrappningens andra vecka,
    // alltså 40 procent av T, och loppet äter upp hela den budgeten.
    const loppveckan = veckorMedBudget(P2).find(({ vecka }) =>
      vecka.raceIds.includes('vasaloppet'),
    );

    expect(loppveckan?.budget.raceMinutes).toBe(420);
    expect(loppveckan?.budget.phaseMinutes).toBeLessThan(420);
    expect(loppveckan?.budget.enduranceMinutes).toBe(0);
    expect(loppveckan?.budget.strengthMinutes).toBe(0);
  });

  it('går aldrig under noll', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        expect(budget.enduranceMinutes, `${namn} vecka ${vecka.index}`).toBeGreaterThanOrEqual(0);
        expect(budget.strengthMinutes, `${namn} vecka ${vecka.index}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('räknar båda loppen när två går samma vecka', () => {
    const sammaVecka: PlanInput = {
      ...P5,
      races: [
        { id: 'vatternrundan', date: '2027-06-18' },
        { id: 'vansbrosimningen', date: '2027-06-20' },
      ],
    };

    const loppveckan = veckorMedBudget(sammaVecka).find(({ vecka }) => vecka.raceIds.length === 2);
    // Vätternrundan 11 timmar plus Vansbrosimningen 1 timme.
    expect(loppveckan?.budget.raceMinutes).toBe(720);
  });
});

describe('R-10: styrka räknas in i veckotiden', () => {
  it('ger två pass i bas, ett i specifik fas och inga i nedtrappning', () => {
    for (const { vecka, budget } of veckorMedBudget(P2)) {
      if (budget.raceMinutes > 0) continue; // loppveckan har sin egen regel

      const förväntat =
        rules.strength.sessionsByPhase[vecka.phase] * rules.strength.minutesPerSession;
      expect(budget.strengthMinutes, `vecka ${vecka.index} ${vecka.phase}`).toBe(förväntat);
    }
  });

  it('tar styrkan ur veckans tid, inte ovanpå den', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        const tillgängligt = Math.max(0, budget.phaseMinutes - budget.raceMinutes);
        expect(budget.strengthMinutes + budget.enduranceMinutes, `${namn} v${vecka.index}`).toBe(
          tillgängligt,
        );
      }
    }
  });
});

describe('R-08: fördelning i specifik fas', () => {
  it('ger loppets sport 55 procent när planen har fler än två sporter', () => {
    const specifik = veckorMedBudget(P2).find(
      ({ vecka, budget }) =>
        vecka.phase === 'specific' && vecka.focusRaceId === 'vasaloppet' && budget.raceMinutes === 0,
    );

    const minuter = specifik?.budget.enduranceMinutes as number;
    const skidor = specifik?.budget.bySport.ski as number;
    expect(skidor / minuter).toBeCloseTo(0.55, 2);
  });

  it('ger loppets sport 65 procent när planen har två sporter', () => {
    // P5 har bara Vätternrundan och Vansbrosimningen: cykel och simning.
    expect(sportsInPlan(P5)).toEqual(['bike', 'swim']);

    const specifik = veckorMedBudget(P5).find(
      ({ vecka, budget }) =>
        vecka.phase === 'specific' &&
        vecka.focusRaceId === 'vatternrundan' &&
        budget.enduranceMinutes > 0,
    );

    const minuter = specifik?.budget.enduranceMinutes as number;
    expect((specifik?.budget.bySport.bike as number) / minuter).toBeCloseTo(0.65, 2);
    expect((specifik?.budget.bySport.swim as number) / minuter).toBeCloseTo(0.35, 2);
  });

  it('lämnar ingen andel ofördelad när planen har ett enda lopp', () => {
    // Acceptanskriteriet för T-04. P4 har bara Vasaloppet, och de 45 procent
    // som annars gått till övriga sporter har ingenstans att ta vägen.
    expect(sportsInPlan(P4)).toEqual(['ski']);

    for (const { vecka, budget } of veckorMedBudget(P4)) {
      expect(budget.bySport.ski, `vecka ${vecka.index}`).toBe(budget.enduranceMinutes);
      expect(summaAvSporter(budget.bySport), `vecka ${vecka.index}`).toBe(budget.enduranceMinutes);
    }
  });

  it('fördelar resten jämnt mellan de övriga sporterna', () => {
    const specifik = veckorMedBudget(P2).find(
      ({ vecka, budget }) =>
        vecka.phase === 'specific' && vecka.focusRaceId === 'vasaloppet' && budget.raceMinutes === 0,
    );

    const övriga = [
      specifik?.budget.bySport.bike as number,
      specifik?.budget.bySport.swim as number,
      specifik?.budget.bySport.run as number,
    ];

    // Högst en minut mellan dem — resten är avrundning.
    expect(Math.max(...övriga) - Math.min(...övriga)).toBeLessThanOrEqual(1);
  });
});

describe('R-09: fördelning i basfasen', () => {
  it('ger mer tid till en sport där nivån är Ny', () => {
    // P1 är ny i skidor och simning, van i cykel och löpning.
    const bas = veckorMedBudget(P1).find(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );
    const { ski, swim, bike, run } = bas?.budget.bySport as Record<TrainedSport, number>;

    expect(ski).toBeGreaterThan(bike);
    expect(ski).toBeGreaterThan(run);
    expect(swim).toBeGreaterThan(bike);
    expect(swim).toBeGreaterThan(run);
  });

  it('fördelar jämnt när ingen sport är ny', () => {
    // P2 är erfaren i allt.
    const bas = veckorMedBudget(P2).find(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );
    const minuter = Object.values(bas?.budget.bySport as Record<string, number>);

    expect(Math.max(...minuter) - Math.min(...minuter)).toBeLessThanOrEqual(1);
  });

  it('ger nybörjarsporten hela bonusen, tagen från de vana', () => {
    // P1: fyra sporter, två nya. Jämnt är 25 procent, så de nya ska ha 35 och
    // de vana 15.
    const bas = veckorMedBudget(P1).find(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );
    const minuter = bas?.budget.enduranceMinutes as number;
    const { ski, swim, bike, run } = bas?.budget.bySport as Record<TrainedSport, number>;

    expect(ski / minuter).toBeCloseTo(0.35, 2);
    expect(swim / minuter).toBeCloseTo(0.35, 2);
    expect(bike / minuter).toBeCloseTo(0.15, 2);
    expect(run / minuter).toBeCloseTo(0.15, 2);
  });

  it('krymper bonusen när det inte finns tio procentenheter att hämta', () => {
    // Tre av fyra sporter nya. Full bonus hade krävt 30 procentenheter från en
    // enda van sport, som bara har 25 att ge. Golvet på halva den jämna andelen
    // gör att den behåller 12,5 procent och bonusen krymper till det som finns.
    const treNya: PlanInput = {
      ...P1,
      levels: { ski: 'new', swim: 'new', run: 'new', bike: 'experienced' },
    };

    const bas = veckorMedBudget(treNya).find(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );
    const minuter = bas?.budget.enduranceMinutes as number;
    const { bike } = bas?.budget.bySport as Record<TrainedSport, number>;

    expect(bike / minuter).toBeCloseTo(0.125, 2);
    expect(summaAvSporter(bas?.budget.bySport as Record<string, number>)).toBe(minuter);
  });

  it('fördelar jämnt när alla sporter är nya', () => {
    const allaNya: PlanInput = {
      ...P1,
      levels: { ski: 'new', swim: 'new', bike: 'new', run: 'new' },
    };

    const bas = veckorMedBudget(allaNya).find(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );
    const minuter = Object.values(bas?.budget.bySport as Record<string, number>);
    expect(Math.max(...minuter) - Math.min(...minuter)).toBeLessThanOrEqual(1);
  });

  it('pressar aldrig en sport under halva den jämna andelen', () => {
    // Golvet ska hålla för varje kombination av nivåer, inte bara de prövade.
    const nivåer: ('new' | 'experienced')[] = ['new', 'experienced'];
    const sporter: TrainedSport[] = ['ski', 'bike', 'swim', 'run'];

    for (let mask = 0; mask < 16; mask += 1) {
      const levels = Object.fromEntries(
        sporter.map((sport, i) => [sport, nivåer[(mask >> i) & 1] as 'new' | 'experienced']),
      );
      const input: PlanInput = { ...P1, levels };

      const bas = veckorMedBudget(input).find(
        ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
      );
      const minuter = bas?.budget.enduranceMinutes as number;
      const golv = (minuter / 4) * rules.sportSplit.base.minShareOfEvenSplit;

      for (const sport of sporter) {
        const fick = bas?.budget.bySport[sport] as number;
        // En minut i marginal för avrundningen.
        expect(fick, `mask ${mask}: ${sport}`).toBeGreaterThanOrEqual(Math.floor(golv) - 1);
      }
    }
  });

  it('ger alla sporter i planen tid i basfasen', () => {
    // Lärdomen från v0: en fjärde gren som aldrig fick tid tränades aldrig.
    // Teknikgrenar går inte att komma ikapp på slutet.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const sporter = sportsInPlan(profil);
      const bas = veckorMedBudget(profil).find(
        ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
      );
      if (bas === undefined) continue;

      for (const sport of sporter) {
        expect(bas.budget.bySport[sport], `${namn}: ${sport}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('R-29: minuter försvinner inte', () => {
  it('fördelar alltid exakt veckans konditionstid', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        expect(summaAvSporter(budget.bySport), `${namn} vecka ${vecka.index}`).toBe(
          budget.enduranceMinutes,
        );
      }
    }
  });

  it('tappar ingen minut ens när tiden inte går jämnt upp', () => {
    // 3 timmar delat på fyra sporter är 45 minuter styck, men efter avdrag för
    // styrka och med nivåbonusen blir det sällan jämna tal.
    for (let timmar = 3; timmar <= 15; timmar += 1) {
      const input: PlanInput = { ...P1, hoursPerWeek: timmar };
      for (const budget of weekBudgets(input)) {
        expect(summaAvSporter(budget.bySport), `${timmar} h, vecka ${budget.index}`).toBe(
          budget.enduranceMinutes,
        );
      }
    }
  });

  it('ger hela minuter, aldrig delar av en minut', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const budget of weekBudgets(profil)) {
        expect(Number.isInteger(budget.phaseMinutes), `${namn} v${budget.index}`).toBe(true);
        expect(Number.isInteger(budget.strengthMinutes), `${namn} v${budget.index}`).toBe(true);
        expect(Number.isInteger(budget.enduranceMinutes), `${namn} v${budget.index}`).toBe(true);
        for (const [sport, minuter] of Object.entries(budget.bySport)) {
          expect(Number.isInteger(minuter), `${namn} v${budget.index} ${sport}`).toBe(true);
        }
      }
    }
  });
});

describe('sporterna i planen', () => {
  it('tar sporterna ur de valda loppen, i fast ordning', () => {
    expect(sportsInPlan(P1)).toEqual(['ski', 'bike', 'swim', 'run']);
    expect(sportsInPlan(P3)).toEqual(['ski', 'bike', 'swim', 'run']);
    expect(sportsInPlan(P4)).toEqual(['ski']);
    expect(sportsInPlan(P5)).toEqual(['bike', 'swim']);
  });

  it('ger samma ordning oavsett i vilken ordning loppen står', () => {
    const baklänges: PlanInput = { ...P6, races: [...P6.races].reverse() };
    expect(sportsInPlan(baklänges)).toEqual(sportsInPlan(P6));
  });
});

describe('determinism', () => {
  it('ger samma budgetar varje gång', () => {
    for (const profil of Object.values(PROFILES)) {
      expect(weekBudgets(profil)).toEqual(weekBudgets(profil));
    }
  });

  it('ger samma budgetar oavsett loppens ordning i indatan', () => {
    const baklänges: PlanInput = { ...P6, races: [...P6.races].reverse() };
    expect(weekBudgets(baklänges)).toEqual(weekBudgets(P6));
  });
});
