import { describe, expect, it } from 'vitest';
import { addWeeks, earliest, latest, startOfWeek, weekdayOf, weeksBetween } from '../src/engine/dates.ts';
import { raceById, races } from '../src/engine/config.ts';
import { buildWeeks, placeRaces, planEndDate, weekCount } from '../src/engine/weeks.ts';
import type { IsoDate, PlanInput, RaceId } from '../src/engine/types.ts';
import { P1, P2, P3, P4, P5, P6, PROFILES } from './profiles.ts';

function weekOfRace(input: PlanInput, id: RaceId): number {
  const race = input.races.find((kandidat) => kandidat.id === id);
  if (race === undefined) throw new Error(`Profilen saknar ${id}`);
  return weeksBetween(startOfWeek(input.startDate), startOfWeek(race.date)) + 1;
}

/**
 * De fyra loppens nästa datum efter `start`, inom tolv månader.
 *
 * Loppen går vid ungefär samma tid varje år. Hjälpfunktionen tar månad och dag
 * ur `config/races.json` och väljer det året som ligger på eller efter `start`.
 * Veckodagen blir inte den riktiga, men motorn bryr sig bara om datumet — det
 * som prövas här är att en start i vilken månad som helst ger en hel plan.
 */
function nästaFyraLoppEfter(start: IsoDate): PlanInput['races'] {
  const år = Number(start.slice(0, 4));

  return races.races.map((race) => {
    const månadOchDag = (race.dates[0] as string).slice(5);
    const iÅr = `${år}-${månadOchDag}`;
    return { id: race.id, date: iÅr >= start ? iÅr : `${år + 1}-${månadOchDag}`, goal: 'finish' as const };
  });
}

describe('R-01: planens omfattning', () => {
  it('börjar på måndagen i startdatumets vecka', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const första = buildWeeks(profil)[0];
      expect(första?.startDate, namn).toBe(startOfWeek(profil.startDate));
      expect(weekdayOf(första?.startDate as string), namn).toBe(1);
    }
  });

  it('slutar på söndagen i veckan med det sista loppet', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const sista = buildWeeks(profil).at(-1);
      const slut = planEndDate(profil);
      expect(weekdayOf(slut), namn).toBe(7);
      expect(addWeeks(sista?.startDate as string, 1), namn).toBe(
        addWeeks(startOfWeek(slut), 1),
      );
    }
  });

  it('ger alla veckor en måndag, i ordning och utan luckor', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const veckor = buildWeeks(profil);
      for (const [i, vecka] of veckor.entries()) {
        expect(weekdayOf(vecka.startDate), `${namn} vecka ${i + 1}`).toBe(1);
        expect(vecka.index, namn).toBe(i + 1);
        if (i > 0) {
          const föregående = veckor[i - 1];
          expect(weeksBetween(föregående?.startDate as string, vecka.startDate), namn).toBe(1);
        }
      }
    }
  });

  it('har lika många veckor som perioden rymmer', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      expect(buildWeeks(profil).length, namn).toBe(weekCount(profil));
    }
  });

  it('planerar ingenting efter det sista loppet', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const sista = buildWeeks(profil).at(-1);
      const sistaLoppetsVecka = Math.max(
        ...profil.races.map((race) => weekOfRace(profil, race.id)),
      );
      expect(sista?.index, namn).toBe(sistaLoppetsVecka);
    }
  });
});

describe('R-02: faserna', () => {
  it('använder bara de fyra faserna', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const vecka of buildWeeks(profil)) {
        expect(['base', 'specific', 'taper', 'recovery'], namn).toContain(vecka.phase);
      }
    }
  });

  it('gör varje loppvecka till nedtrappning', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const veckor = buildWeeks(profil);
      for (const race of profil.races) {
        const vecka = veckor[weekOfRace(profil, race.id) - 1];
        expect(vecka?.phase, `${namn}: ${race.id}`).toBe('taper');
      }
    }
  });

  it('lägger specifik fas före nedtrappningen', () => {
    const veckor = buildWeeks(P2);
    const loppvecka = weekOfRace(P2, 'vasaloppet');
    // Vasaloppet har två nedtrappningsveckor, så veckan innan dem är specifik.
    expect(veckor[loppvecka - 2]?.phase).toBe('taper');
    expect(veckor[loppvecka - 3]?.phase).toBe('specific');
  });

  it('lägger återhämtning direkt efter ett lopp', () => {
    const veckor = buildWeeks(P2);
    const loppvecka = weekOfRace(P2, 'vasaloppet');
    // Vasaloppet tar sju timmar och kräver två återhämtningsveckor.
    expect(veckor[loppvecka]?.phase).toBe('recovery');
    expect(veckor[loppvecka + 1]?.phase).toBe('recovery');
  });

  it('börjar långt från första loppet med bas', () => {
    expect(buildWeeks(P2)[0]?.phase).toBe('base');
  });

  it('ger sammanhängande veckor i samma fas samma phaseId', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const veckor = buildWeeks(profil);
      for (const [i, vecka] of veckor.entries()) {
        const föregående = veckor[i - 1];
        if (föregående === undefined) continue;
        const sammaFas =
          föregående.phase === vecka.phase && föregående.focusRaceId === vecka.focusRaceId;
        if (sammaFas) {
          expect(vecka.phaseId, namn).toBe(föregående.phaseId);
        } else {
          expect(vecka.phaseId, namn).not.toBe(föregående.phaseId);
        }
      }
    }
  });

  it('ger varje vecka ett phaseId', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const vecka of buildWeeks(profil)) {
        expect(vecka.phaseId.length, namn).toBeGreaterThan(0);
      }
    }
  });
});

describe('R-03: blocklogiken', () => {
  it('kortar nedtrappningen för det andra loppet, inte återhämtningen', () => {
    const lopp = placeRaces(P5);
    const vattern = lopp.find((race) => race.id === 'vatternrundan');
    const vansbro = lopp.find((race) => race.id === 'vansbrosimningen');

    // Två veckor isär, alltså mindre än fyra.
    expect((vansbro?.weekIndex as number) - (vattern?.weekIndex as number)).toBe(2);
    expect(vansbro?.taperWeeks).toBe(1);

    // Kroppen ska få vila efter 315 kilometer. Återhämtningen kortas bara så
    // mycket som behövs för att inte läggas ovanpå nästa loppvecka: en vecka
    // ryms mellan loppen, alltså blir det en.
    expect(vattern?.recoveryWeeks).toBe(1);
  });

  it('ger återhämtning mellan loppen i P5', () => {
    const veckor = buildWeeks(P5);
    const vattern = weekOfRace(P5, 'vatternrundan');

    // Veckan direkt efter Vätternrundan är återhämtning, inte uppbyggnad.
    expect(veckor[vattern]?.phase).toBe('recovery');
    expect(veckor[vattern]?.focusRaceId).toBe('vatternrundan');
  });

  it('ger det andra loppet bara sin loppvecka när de ligger tätt', () => {
    // Ligger Vansbrosimningen två veckor efter Vätternrundan hinner den inte
    // få någon egen uppbyggnad — veckan emellan är återhämtning. Det är ett
    // medvetet val: tre kilometer simning är görbart med tekniken i ryggen,
    // och kroppen behöver vilan efter 315 kilometer mer än den behöver
    // ytterligare simvolym.
    const veckor = buildWeeks(P5);
    const vansbro = weekOfRace(P5, 'vansbrosimningen');

    expect(veckor[vansbro - 1]?.phase).toBe('taper');
    expect(veckor[vansbro - 1]?.focusRaceId).toBe('vansbrosimningen');

    const egna = veckor.filter(
      (vecka) => vecka.focusRaceId === 'vansbrosimningen' && vecka.phase === 'specific',
    );
    expect(egna).toEqual([]);
  });

  it('rör inte lopp som ligger fyra veckor eller mer isär', () => {
    const isär: PlanInput = {
      ...P2,
      races: [
        { id: 'vasaloppet', date: '2027-03-07', goal: 'finish' },
        { id: 'vatternrundan', date: '2027-06-18', goal: 'finish' },
      ],
    };

    for (const race of placeRaces(isär)) {
      const config = raceById(race.id);
      expect(race.taperWeeks, race.id).toBe(config.taperWeeks);
      expect(race.recoveryWeeks, race.id).toBe(config.recoveryWeeks);
    }
  });

  it('slår till på de riktiga loppdatumen, inte bara i kantfall', () => {
    // Vätternrundan 18 juni och Vansbrosimningen 10 juli ligger bara tre
    // veckor isär. Blocklogiken är alltså normalfallet för den som gör hela
    // klassikern, inte ett undantag.
    const lopp = placeRaces(P1);
    const vattern = lopp.find((race) => race.id === 'vatternrundan');
    const vansbro = lopp.find((race) => race.id === 'vansbrosimningen');

    expect((vansbro?.weekIndex as number) - (vattern?.weekIndex as number)).toBe(3);
    expect(vansbro?.taperWeeks).toBe(1);

    // Tre veckor isär rymmer båda återhämtningsveckorna efter Vätternrundan.
    expect(vattern?.recoveryWeeks).toBe(2);
  });
});

describe('R-27: flera lopp samma vecka', () => {
  const sammaVecka: PlanInput = {
    ...P5,
    races: [
      { id: 'vatternrundan', date: '2027-06-18', goal: 'finish' },
      { id: 'vansbrosimningen', date: '2027-06-20', goal: 'finish' },
    ],
  };

  it('lägger båda loppen i samma vecka', () => {
    const veckor = buildWeeks(sammaVecka);
    const med = veckor.filter((vecka) => vecka.raceIds.length > 0);
    expect(med).toHaveLength(1);
    expect(med[0]?.raceIds).toEqual(['vatternrundan', 'vansbrosimningen']);
  });

  it('tappar inget lopp ur planen', () => {
    const alla = buildWeeks(sammaVecka).flatMap((vecka) => vecka.raceIds);
    for (const race of sammaVecka.races) {
      expect(alla).toContain(race.id);
    }
  });

  it('gör veckan till nedtrappning för det första loppet', () => {
    const vecka = buildWeeks(sammaVecka).find((kandidat) => kandidat.raceIds.length > 1);
    expect(vecka?.phase).toBe('taper');
    expect(vecka?.focusRaceId).toBe('vatternrundan');
  });

  it('markerar loppveckorna även när loppen ligger isär', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const alla = buildWeeks(profil).flatMap((vecka) => vecka.raceIds);
      expect(alla.sort(), namn).toEqual(profil.races.map((race) => race.id).sort());
    }
  });
});

describe('R-06: avlastningsveckor', () => {
  it('lägger en avlastningsvecka var fjärde vecka i bas och specifik fas', () => {
    const veckor = buildWeeks(P2);
    let sedan = 0;
    for (const vecka of veckor) {
      if (vecka.phase === 'base' || vecka.phase === 'specific') {
        sedan += 1;
        expect(sedan, `vecka ${vecka.index}`).toBeLessThanOrEqual(4);
        if (vecka.isDeload) sedan = 0;
      } else {
        sedan = 0;
      }
    }
  });

  it('markerar aldrig nedtrappning eller återhämtning som avlastning', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const vecka of buildWeeks(profil)) {
        if (vecka.phase === 'taper' || vecka.phase === 'recovery') {
          expect(vecka.isDeload, `${namn} vecka ${vecka.index}`).toBe(false);
        }
      }
    }
  });
});

describe('P4: en enda sport och kort tid', () => {
  it('ger en plan på sex veckor', () => {
    const veckor = buildWeeks(P4);
    expect(veckor.length).toBe(weekOfRace(P4, 'vasaloppet'));
    expect(veckor.length).toBeLessThanOrEqual(7);
  });

  it('hinner inte med hela den specifika fasen, utan trappar ner i tid', () => {
    const veckor = buildWeeks(P4);
    const loppvecka = veckor.at(-1);
    expect(loppvecka?.phase).toBe('taper');
    expect(loppvecka?.focusRaceId).toBe('vasaloppet');
  });

  it('har inga veckor utan fokuslopp', () => {
    for (const vecka of buildWeeks(P4)) {
      expect(vecka.focusRaceId).toBe('vasaloppet');
    }
  });
});

describe('datum över årsskifte och sommartid', () => {
  it('håller måndagar genom årsskiftet 2026–2027', () => {
    const veckor = buildWeeks(P1);
    const överÅrsskiftet = veckor.filter(
      (vecka) => vecka.startDate >= '2026-12-21' && vecka.startDate <= '2027-01-11',
    );
    expect(överÅrsskiftet.length).toBeGreaterThan(0);
    for (const vecka of överÅrsskiftet) {
      expect(weekdayOf(vecka.startDate), vecka.startDate).toBe(1);
    }
  });

  it('håller måndagar över sommartidsskiftet 28 mars 2027', () => {
    // Klockan ställs om natten mot söndag 28 mars. Veckan som börjar 22 mars
    // ska följas av den som börjar 29 mars, inte 28 eller 30.
    expect(addWeeks('2027-03-22', 1)).toBe('2027-03-29');
    expect(weekdayOf('2027-03-29')).toBe(1);

    const veckor = buildWeeks(P3);
    const mars = veckor.find((vecka) => vecka.startDate === '2027-03-22');
    const nästa = veckor.find((vecka) => vecka.startDate === '2027-03-29');
    expect(mars).toBeDefined();
    expect(nästa?.index).toBe((mars?.index as number) + 1);
  });

  it('räknar veckor rätt över ett helt år', () => {
    // 2026-11-02 till 2027-09-25 är 47 veckor, båda inklusive.
    expect(weekCount(P1)).toBe(47);
  });
});

describe('starten är fri: klassikern kan börja när som helst på året', () => {
  it('klarar att loppen kommer i en annan ordning än kalenderns', () => {
    // P6 listar Vasaloppet först, som man brukar rabbla klassikern, fast det
    // går sist i tiden. Planen ska följa datumen, inte listans ordning.
    const lopp = placeRaces(P6);
    expect(lopp.map((race) => race.id)).toEqual([
      'vatternrundan',
      'vansbrosimningen',
      'lidingoloppet',
      'vasaloppet',
    ]);
  });

  it('gör Vasaloppet till sista loppet vid en vårstart', () => {
    const veckor = buildWeeks(P6);
    const sista = veckor.at(-1);
    expect(sista?.phase).toBe('taper');
    expect(sista?.focusRaceId).toBe('vasaloppet');
    expect(sista?.raceIds).toEqual(['vasaloppet']);
  });

  it('ger samma plan oavsett vilken ordning loppen står i indatan', () => {
    const baklänges: PlanInput = { ...P6, races: [...P6.races].reverse() };
    expect(buildWeeks(baklänges)).toEqual(buildWeeks(P6));
  });

  it('ger en plan för en start i varje månad på året', () => {
    // Tolv starter, var och en med sina fyra lopp inom tolv månader. Ingen av
    // dem får sakna veckor, tappa ett lopp eller hamna i en okänd fas.
    for (let månad = 1; månad <= 12; månad += 1) {
      const start = `2027-${String(månad).padStart(2, '0')}-05`;
      const input: PlanInput = {
        ...P2,
        today: start,
        startDate: start,
        races: nästaFyraLoppEfter(start),
      };

      const veckor = buildWeeks(input);
      expect(veckor.length, start).toBe(weekCount(input));
      expect(veckor.length, start).toBeGreaterThan(0);

      const markerade = veckor.flatMap((vecka) => vecka.raceIds);
      expect(markerade.length, start).toBe(4);
      expect(new Set(markerade).size, start).toBe(4);
    }
  });

  it('håller sig inom tolv månader i alla tolv starterna', () => {
    // R-26: en klassiker ska rymmas inom tolv månader. Hjälpfunktionen ovan
    // ska alltså aldrig bygga indata som utlöser varningen.
    for (let månad = 1; månad <= 12; månad += 1) {
      const start = `2027-${String(månad).padStart(2, '0')}-05`;
      const datum = nästaFyraLoppEfter(start).map((race) => race.date);
      const spann = weeksBetween(earliest(datum), latest(datum));
      expect(spann, start).toBeLessThanOrEqual(52);
    }
  });
});
