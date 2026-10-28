import { describe, expect, it } from 'vitest';
import { sportsInPlan, weekBudgets } from '../src/engine/budget.ts';
import { raceById, rules } from '../src/engine/config.ts';
import { monthOf } from '../src/engine/dates.ts';
import { buildWeeks } from '../src/engine/weeks.ts';
import type { PlanInput, TrainedSport } from '../src/engine/types.ts';
import { P1, P2, P3, P4, P5, P6, PROFILES } from './profiles.ts';

/** Veckorna och deras budgetar parvis — testerna behöver nästan alltid båda. */
function veckorMedBudget(input: PlanInput) {
  const veckor = buildWeeks(input);
  const budgetar = weekBudgets(input);
  return veckor.map((vecka, i) => ({ vecka, budget: budgetar[i] as (typeof budgetar)[number] }));
}

/**
 * Sant när löptaket i R-14 inte har flyttat minuter den här veckan.
 *
 * Slår taket till hamnar överskottet hos de andra grenarna, och då stämmer
 * inte säsongsvikterna för just den veckan. Det är inte ett fel — det är två
 * regler som båda gäller, och löptaket väger tyngre eftersom det skyddar mot
 * skada.
 */
function utanLöptak(budget: { bySport: Partial<Record<TrainedSport, number>> }, förväntatRun: number): boolean {
  const run = budget.bySport.run ?? 0;
  return run >= förväntatRun - 1;
}

/**
 * Sant när alla loppen i planen ligger framför veckan.
 *
 * Säsongsvikterna i R-32 gäller bara så länge grenens lopp är kvar. Är ett
 * lopp avklarat flyttas dess grens tid till nästa lopps gren (R-36), och då
 * stämmer inte vikterna längre.
 */
function allaLoppKvar(input: PlanInput, vecka: { startDate: string }): boolean {
  return input.races.every((race) => race.date >= vecka.startDate);
}

/**
 * Säsongens vikter för en månad, enligt R-32.
 *
 * `levels` behövs eftersom vikten sänks för den som inte är nybörjare i en
 * gren som står i `experiencedWeightOverride` — i dag simning.
 */
function säsongsvikter(månad: number, levels: PlanInput['levels'] = {}) {
  const säsong = rules.seasonWeights.seasons.find((s) => s.months.includes(månad));
  if (säsong === undefined) throw new Error("månad " + månad + " saknar säsong");

  const ut = { ...säsong.weights };
  for (const [sport, vikt] of Object.entries(rules.seasonWeights.experiencedWeightOverride)) {
    const gren = sport as 'swim';
    if (levels[gren] !== 'new') ut[gren] = vikt as number;
  }

  // Normera, som motorn gör: en sänkt vikt får inte göra veckan kortare.
  const summa = ut.ski + ut.bike + ut.swim + ut.run;
  return { ski: ut.ski / summa, bike: ut.bike / summa, swim: ut.swim / summa, run: ut.run / summa };
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
    // Vätternrundan 11 timmar plus Vansbrosimningen 1,25 timmar.
    expect(loppveckan?.budget.raceMinutes).toBe(735);
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

  it('fördelar resten mellan de övriga sporterna efter säsongen (R-32)', () => {
    const specifik = veckorMedBudget(P2).find(
      ({ vecka, budget }) =>
        vecka.phase === 'specific' &&
        vecka.focusRaceId === 'vasaloppet' &&
        budget.raceMinutes === 0 &&
        allaLoppKvar(P2, vecka),
    );

    const månad = monthOf(specifik?.vecka.startDate as string);
    const vikter = säsongsvikter(månad, P2.levels);
    const kvar =
      (specifik?.budget.enduranceMinutes as number) - (specifik?.budget.bySport.ski as number);
    const summaÖvriga = vikter.bike + vikter.swim + vikter.run;

    const förväntatRun = (kvar * vikter.run) / summaÖvriga;
    if (!utanLöptak(specifik?.budget as never, förväntatRun)) return;

    for (const sport of ['bike', 'swim', 'run'] as const) {
      const förväntat = (kvar * vikter[sport]) / summaÖvriga;
      // Två minuter i marginal för avrundningen.
      expect(specifik?.budget.bySport[sport] as number, sport).toBeCloseTo(förväntat, -0.5);
    }
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

  it('följer säsongens vikter när ingen sport är ny (R-32)', () => {
    // P2 är erfaren i allt, så ingen bonus flyttar tid.
    for (const { vecka, budget } of veckorMedBudget(P2)) {
      if (vecka.phase !== 'base' || budget.enduranceMinutes === 0) continue;
      // Efter ett avklarat lopp gäller R-36 i stället.
      if (!allaLoppKvar(P2, vecka)) continue;

      const vikter = säsongsvikter(monthOf(vecka.startDate), P2.levels);
      if (!utanLöptak(budget, budget.enduranceMinutes * vikter.run)) continue;

      for (const sport of ['ski', 'bike', 'swim', 'run'] as const) {
        const förväntat = budget.enduranceMinutes * vikter[sport];
        expect(budget.bySport[sport] as number, vecka.index + " " + sport).toBeCloseTo(
          förväntat,
          -0.5,
        );
      }
    }
  });

  it('ger nybörjarsporten mer än säsongens vikt, tagen från de vana', () => {
    // P1 är ny i skidor och simning. Skidorna ska få mer än säsongen ger och
    // de vana sporterna mindre. Simningen har dessutom ett tak i R-31 som
    // kan bita först, och prövas därför i sitt eget test.
    for (const { vecka, budget } of veckorMedBudget(P1)) {
      if (vecka.phase !== 'base' || budget.enduranceMinutes === 0) continue;
      if (!allaLoppKvar(P1, vecka)) continue;

      const vikter = säsongsvikter(monthOf(vecka.startDate), P1.levels);
      const minuter = budget.enduranceMinutes;

      expect(budget.bySport.ski as number, "v" + vecka.index).toBeGreaterThan(
        minuter * vikter.ski,
      );
      expect(budget.bySport.bike as number, "v" + vecka.index).toBeLessThan(
        minuter * vikter.bike + 1,
      );
      expect(budget.bySport.run as number, "v" + vecka.index).toBeLessThan(
        minuter * vikter.run + 1,
      );
    }
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

  it('följer säsongens vikter när alla sporter är nya', () => {
    // Är alla nya finns ingen att flytta tid ifrån, så säsongen bestämmer.
    const allaNya: PlanInput = {
      ...P1,
      levels: { ski: 'new', swim: 'new', bike: 'new', run: 'new' },
    };

    const bas = veckorMedBudget(allaNya).find(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );
    const vikter = säsongsvikter(monthOf(bas?.vecka.startDate as string), allaNya.levels);
    const minuter = bas?.budget.enduranceMinutes as number;

    // Skidor och cykel har inget tak i R-31 och följer vikterna rakt.
    expect(bas?.budget.bySport.ski as number).toBeCloseTo(minuter * vikter.ski, -0.5);
    expect(bas?.budget.bySport.bike as number).toBeCloseTo(minuter * vikter.bike, -0.5);
  });

  it('låter bonusen aldrig pressa en sport under halva den jämna andelen', () => {
    // Golvet skyddar mot att nybörjarbonusen tar för mycket från en gren. Det
    // skyddar inte mot att säsongens egen vikt är låg — en gren som säsongen
    // tonar ner ska få lite tid, det är hela poängen med R-32.
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
      const vikter = säsongsvikter(monthOf(bas?.vecka.startDate as string), levels);
      const golv = (minuter / 4) * rules.sportSplit.base.minShareOfEvenSplit;

      for (const sport of sporter) {
        const fick = bas?.budget.bySport[sport] as number;
        // Grenen ska ha minst golvet, eller minst sin säsongsvikt när den är
        // lägre än golvet. En minut i marginal för avrundningen.
        const kräv = Math.min(golv, minuter * vikter[sport]);
        expect(fick, `mask ${mask}: ${sport}`).toBeGreaterThanOrEqual(Math.floor(kräv) - 1);
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

describe('R-31: nybörjartak per sport', () => {
  const TAK = rules.newLevelLimits.bySport.swim as {
    maxMinutesPerWeek: number;
    maxSessionsPerWeek: number;
  };

  it('ger den som är ny i simning högst 80 minuter i veckan', () => {
    // P1 är ny i simning. Nybörjarkurser är en timme i veckan.
    for (const { vecka, budget } of veckorMedBudget(P1)) {
      expect(budget.bySport.swim ?? 0, `vecka ${vecka.index}`).toBeLessThanOrEqual(
        TAK.maxMinutesPerWeek,
      );
    }
  });

  it('gäller också i ett eget simblock', () => {
    // Utan taket skulle simningen få hela veckan i sitt eget block. Efter
    // Vätternrundan hinner Vansbrosimningen inte få någon specifik fas, så
    // fallet prövas med en plan där simningen ligger ensam.
    const simblock: PlanInput = {
      ...P1,
      races: [{ id: 'vansbrosimningen', date: '2027-07-10' }],
      levels: { swim: 'new' },
    };

    const specifika = veckorMedBudget(simblock).filter(
      ({ vecka, budget }) => vecka.phase === 'specific' && budget.enduranceMinutes > 0,
    );

    expect(specifika.length).toBeGreaterThan(0);
    for (const { vecka, budget } of specifika) {
      expect(budget.bySport.swim, `vecka ${vecka.index}`).toBeLessThanOrEqual(
        TAK.maxMinutesPerWeek,
      );
    }
  });

  it('räknar loppet och öppningspasset mot taket', () => {
    // Vansbrosimningen tar en timme och öppningspasset 25 minuter. Tillsammans
    // är det mer än taket, så loppveckan får ingen planerad simträning alls.
    const loppveckan = veckorMedBudget(P1).find(({ vecka }) =>
      vecka.raceIds.includes('vansbrosimningen'),
    );

    expect(loppveckan).toBeDefined();
    expect(loppveckan?.budget.bySport.swim).toBe(0);
  });

  it('flyttar de frigjorda minuterna till de andra sporterna', () => {
    for (const { vecka, budget } of veckorMedBudget(P1)) {
      expect(
        summaAvSporter(budget.bySport) + budget.unplacedMinutes,
        `vecka ${vecka.index}`,
      ).toBe(budget.enduranceMinutes);
    }
  });

  it('rör inte den som är van i sporten', () => {
    // P2 är erfaren i allt och ska inte träffas av något tak.
    const över = veckorMedBudget(P2).filter(
      ({ budget }) => (budget.bySport.swim ?? 0) > TAK.maxMinutesPerWeek,
    );
    expect(över.length).toBeGreaterThan(0);
  });

  it('lämnar inga minuter oplacerade när andra sporter har plats', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        expect(budget.unplacedMinutes, `${namn} vecka ${vecka.index}`).toBe(0);
      }
    }
  });

  it('visar veckans faktiska tid när ingen sport har plats kvar', () => {
    // En plan med bara Vansbrosimningen, för en nybörjare: taket på 80 minuter
    // är allt som går att träna, hur många timmar hon än har sagt att hon kan.
    const baraSimning: PlanInput = {
      ...P1,
      races: [{ id: 'vansbrosimningen', date: '2027-07-10' }],
      levels: { swim: 'new' },
      hoursPerWeek: 8,
    };

    const basveckor = veckorMedBudget(baraSimning).filter(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );

    expect(basveckor.length).toBeGreaterThan(0);
    for (const { vecka, budget } of basveckor) {
      expect(budget.bySport.swim, `vecka ${vecka.index}`).toBe(TAK.maxMinutesPerWeek);
      expect(budget.unplacedMinutes, `vecka ${vecka.index}`).toBeGreaterThan(0);
      expect(
        summaAvSporter(budget.bySport) + budget.unplacedMinutes,
        `vecka ${vecka.index}`,
      ).toBe(budget.enduranceMinutes);
    }
  });
});

describe('R-32: säsongen styr fördelningen', () => {
  it('ger skidorna mest på vintern och cykeln mest på sommaren', () => {
    // P2 är erfaren i allt, så bara säsongen skiljer veckorna.
    const bas = veckorMedBudget(P2).filter(
      ({ vecka, budget }) => vecka.phase === 'base' && budget.enduranceMinutes > 0,
    );

    // Bara veckor där inget lopp är avklarat: därefter styr R-36.
    const kvar = bas.filter(({ vecka }) => allaLoppKvar(P2, vecka));

    const vinter = kvar.filter(({ vecka }) => [11, 12, 1, 2, 3].includes(monthOf(vecka.startDate)));
    const sommar = kvar.filter(({ vecka }) => [5, 6, 7, 8, 9].includes(monthOf(vecka.startDate)));

    expect(vinter.length).toBeGreaterThan(0);
    for (const { vecka, budget } of vinter) {
      expect(budget.bySport.ski as number, `vecka ${vecka.index}`).toBeGreaterThan(
        budget.bySport.bike as number,
      );
    }
    for (const { vecka, budget } of sommar) {
      expect(budget.bySport.bike as number, `vecka ${vecka.index}`).toBeGreaterThan(
        budget.bySport.ski as number,
      );
    }
  });

  it('håller löpningen nere året om', () => {
    // Löpningen sliter mer än skidor och cykel och får därför aldrig mest tid
    // i en basvecka — utom när löpningen är loppets egen sport.
    for (const { vecka, budget } of veckorMedBudget(P2)) {
      if (vecka.phase !== 'base' || budget.enduranceMinutes === 0) continue;
      // Är Lidingöloppet det enda kvarvarande loppet ska löpningen dominera.
      if (!allaLoppKvar(P2, vecka)) continue;

      const mest = Math.max(
        budget.bySport.ski as number,
        budget.bySport.bike as number,
        budget.bySport.swim as number,
      );
      expect(budget.bySport.run as number, `vecka ${vecka.index}`).toBeLessThanOrEqual(mest);
    }
  });

  it('lägger underhållstiden i ett löparblock på cykeln, inte på skidorna', () => {
    // Lidingöloppets block ligger i augusti. Då är både Vasaloppet och
    // Vätternrundan avklarade, så skidorna är nollade av R-36 och cykeln får
    // det lilla underhåll som finns. Skidåkning i augusti är ändå inte
    // möjligt för de flesta.
    const lidingö = veckorMedBudget(P2).find(
      ({ vecka, budget }) =>
        vecka.phase === 'specific' &&
        vecka.focusRaceId === 'lidingoloppet' &&
        budget.enduranceMinutes > 0 &&
        !vecka.isDeload,
    );

    expect(monthOf(lidingö?.vecka.startDate as string)).toBeGreaterThanOrEqual(7);
    expect(lidingö?.budget.bySport.ski as number).toBe(0);
    expect(lidingö?.budget.bySport.bike as number).toBeGreaterThan(0);
  });

  it('ger alla sporter tid i varje vecka, också den som säsongen tonar ner', () => {
    // Man behöver inte fokusera på allt samtidigt, men ingen gren får tappas
    // helt — teknikgrenar går inte att komma ikapp på slutet.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const sporter = sportsInPlan(profil);
      if (sporter.length < 2) continue;

      for (const { vecka, budget } of veckorMedBudget(profil)) {
        if (budget.enduranceMinutes === 0) continue;
        // Loppveckan är undantaget: där kan R-31 nolla loppets egen sport,
        // eftersom loppet och öppningspasset redan är veckans tid i den.
        if (budget.raceMinutes > 0) continue;

        for (const sport of sporter) {
          // R-36: en gren vars lopp är avklarat ska inte längre tränas.
          const loppKvar = profil.races.some(
            (race) => raceById(race.id).sport === sport && race.date >= vecka.startDate,
          );
          if (!loppKvar) continue;

          expect(budget.bySport[sport], `${namn} v${vecka.index} ${sport}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('summerar alltid till veckans konditionstid, oavsett säsong', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        expect(
          summaAvSporter(budget.bySport) + budget.unplacedMinutes,
          `${namn} v${vecka.index}`,
        ).toBe(budget.enduranceMinutes);
      }
    }
  });

  it('normerar vikterna när planen inte har alla fyra sporterna', () => {
    // P5 har bara cykel och simning. Vinterns vikter är 0,15 och 0,15, alltså
    // lika — andelarna ska då bli hälften var och inte 30 procent av veckan.
    const vinter = veckorMedBudget(P5).find(
      ({ vecka, budget }) =>
        vecka.phase === 'base' &&
        budget.enduranceMinutes > 0 &&
        [12, 1, 2].includes(monthOf(vecka.startDate)),
    );

    const summa = summaAvSporter(vinter?.budget.bySport as Record<string, number>);
    expect(summa).toBe(vinter?.budget.enduranceMinutes);
  });
});

describe('R-36: en avklarad grens tid går till nästa lopp', () => {
  /** Veckans budget för en profil vid ett visst veckonummer. */
  function vecka(input: PlanInput, index: number) {
    return veckorMedBudget(input).find(({ vecka: v }) => v.index === index);
  }

  it('gör cykeln till huvudgren veckan efter Vasaloppet', () => {
    // Vasaloppet går vecka 18 i P2. Veckorna 21–22 är bas mot Vätternrundan.
    const efter = vecka(P2, 21);

    expect(efter?.vecka.phase).toBe('base');
    expect(efter?.vecka.focusRaceId).toBe('vatternrundan');
    expect(efter?.budget.bySport.bike as number).toBeGreaterThan(
      efter?.budget.bySport.ski as number,
    );
  });

  it('behåller en liten andel skidor så länge det är vinter', () => {
    // Mars är skidsäsong. Finns det snö kan skidor användas som konditions-
    // träning, men inte som huvudgren.
    const mars = vecka(P2, 21);

    expect(monthOf(mars?.vecka.startDate as string)).toBe(3);
    expect(mars?.budget.bySport.ski as number).toBeGreaterThan(0);

    const andel = (mars?.budget.bySport.ski as number) / (mars?.budget.enduranceMinutes as number);
    expect(andel).toBeLessThanOrEqual(rules.afterRace.keepShareInOwnSeason + 0.01);
  });

  it('ger noll skidor utanför skidsäsongen', () => {
    for (const { vecka: v, budget } of veckorMedBudget(P2)) {
      if (budget.enduranceMinutes === 0) continue;

      const vasaKlart = (P2.races.find((r) => r.id === 'vasaloppet')?.date as string) < v.startDate;
      const månad = monthOf(v.startDate);
      const skidsäsong = [11, 12, 1, 2, 3].includes(månad);

      if (vasaKlart && !skidsäsong) {
        expect(budget.bySport.ski, `vecka ${v.index} (månad ${månad})`).toBe(0);
      }
    }
  });

  it('rör inte grenar vars lopp ligger kvar', () => {
    // Före Vasaloppet ska skidorna ha full säsongsvikt.
    const före = vecka(P2, 5);
    expect(före?.budget.bySport.ski as number).toBeGreaterThan(
      före?.budget.bySport.bike as number,
    );
  });

  it('minskar skidtiden efter Vasaloppet kraftigt', () => {
    const vasa = P2.races.find((r) => r.id === 'vasaloppet')?.date as string;
    const efter = veckorMedBudget(P2).filter(({ vecka: v }) => v.startDate > vasa);

    const skidtid = efter.reduce((a, { budget }) => a + (budget.bySport.ski ?? 0), 0);

    // Före regeln var det 33 timmar. Nu ska det vara en bråkdel.
    expect(skidtid / 60).toBeLessThan(10);
  });

  it('tappar inga minuter när en gren nollas', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka: v, budget } of veckorMedBudget(profil)) {
        expect(
          summaAvSporter(budget.bySport) + budget.unplacedMinutes,
          `${namn} v${v.index}`,
        ).toBe(budget.enduranceMinutes);
      }
    }
  });
});

describe('R-14: löptiden ökar högst tio procent i veckan', () => {
  /** Senaste normala veckans löptid, som taket räknas på. */
  function löpreferenser(input: PlanInput) {
    const rader = veckorMedBudget(input);
    const resultat: { index: number; run: number; ref: number | null }[] = [];
    let ref: number | null = null;

    for (const { vecka, budget } of rader) {
      resultat.push({ index: vecka.index, run: budget.bySport.run ?? 0, ref });

      const normal =
        (vecka.phase === 'base' || vecka.phase === 'specific') &&
        !vecka.isDeload &&
        vecka.raceIds.length === 0 &&
        budget.enduranceMinutes > 0;

      if (normal) ref = budget.bySport.run ?? ref;
    }

    return resultat;
  }

  it('håller taket i alla profiler', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const rader = veckorMedBudget(profil);

      for (const { index, run, ref } of löpreferenser(profil)) {
        if (ref === null || ref === 0) continue;

        // Loppveckan har sin egen logik.
        const vecka = rader.find(({ vecka: v }) => v.index === index);
        if ((vecka?.vecka.raceIds.length ?? 0) > 0) continue;

        const tak = Math.floor(ref * (1 + rules.runVolume.maxWeeklyIncrease));
        expect(run, `${namn} vecka ${index} (ref ${ref})`).toBeLessThanOrEqual(tak);
      }
    }
  });

  it('låter löpningen växa, inte stå still', () => {
    // Taket är en gräns på ökningstakten, inte ett förbud mot att öka.
    const rader = löpreferenser(P2).filter(({ run }) => run > 0);
    const första = rader[0]?.run as number;
    const högsta = Math.max(...rader.map(({ run }) => run));

    expect(högsta).toBeGreaterThan(första * 2);
  });

  it('hindrar hoppet när de andra loppen är avklarade', () => {
    // Utan taket växte löpningen från nittio minuter till åtta timmar på en
    // vecka när Vätternrundan och Vansbrosimningen var avklarade och all tid
    // gick till Lidingöloppet.
    const lidingö = veckorMedBudget(P2).filter(
      ({ vecka }) => vecka.focusRaceId === 'lidingoloppet' && vecka.phase === 'specific',
    );

    const högsta = Math.max(...lidingö.map(({ budget }) => budget.bySport.run ?? 0));
    expect(högsta).toBeLessThan(300);
  });

  it('tappar inga minuter när taket skär', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const { vecka, budget } of veckorMedBudget(profil)) {
        expect(
          summaAvSporter(budget.bySport) + budget.unplacedMinutes,
          `${namn} v${vecka.index}`,
        ).toBe(budget.enduranceMinutes);
      }
    }
  });

  it('respekterar nybörjartaket när det flyttar minuter', () => {
    // Löptaket får inte trycka simningen över sina åttio minuter (R-31).
    const tak = rules.newLevelLimits.bySport.swim?.maxMinutesPerWeek as number;

    for (const { vecka, budget } of veckorMedBudget(P1)) {
      expect(budget.bySport.swim ?? 0, `vecka ${vecka.index}`).toBeLessThanOrEqual(tak);
    }
  });

  it('ger inte tillbaka tid till en gren vars lopp är avklarat', () => {
    // Skidor i augusti är inte ett alternativ bara för att löpningen fick för
    // mycket (R-36).
    const vasa = P2.races.find((r) => r.id === 'vasaloppet')?.date as string;

    for (const { vecka, budget } of veckorMedBudget(P2)) {
      if (vecka.startDate <= vasa) continue;
      if ([11, 12, 1, 2, 3].includes(monthOf(vecka.startDate))) continue;

      expect(budget.bySport.ski ?? 0, `vecka ${vecka.index}`).toBe(0);
    }
  });
});
