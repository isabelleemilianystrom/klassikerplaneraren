import { describe, expect, it } from 'vitest';
import { addWeeks, startOfWeek, weekdayOf, weeksBetween } from '../src/engine/dates';
import { raceById } from '../src/engine/config';
import { buildWeeks, placeRaces, planEndDate, weekCount } from '../src/engine/weeks';
import type { PlanInput, RaceId } from '../src/engine/types';
import { P1, P2, P3, P4, P5, PROFILES } from './profiles';

function weekOfRace(input: PlanInput, id: RaceId): number {
  const race = input.races.find((kandidat) => kandidat.id === id);
  if (race === undefined) throw new Error(`Profilen saknar ${id}`);
  return weeksBetween(startOfWeek(input.startDate), startOfWeek(race.date)) + 1;
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
  it('tar bort återhämtningen efter det första av två tätt liggande lopp', () => {
    const lopp = placeRaces(P5);
    const vattern = lopp.find((race) => race.id === 'vatternrundan');
    const vansbro = lopp.find((race) => race.id === 'vansbrosimningen');

    // Två veckor isär, alltså mindre än fyra.
    expect((vansbro?.weekIndex as number) - (vattern?.weekIndex as number)).toBe(2);
    expect(vattern?.recoveryWeeks).toBe(0);
    expect(vansbro?.taperWeeks).toBe(1);
  });

  it('ger ingen återhämtningsvecka mellan loppen i P5', () => {
    const veckor = buildWeeks(P5);
    const vattern = weekOfRace(P5, 'vatternrundan');
    const vansbro = weekOfRace(P5, 'vansbrosimningen');

    for (let i = vattern; i < vansbro - 1; i += 1) {
      expect(veckor[i]?.phase, `vecka ${i + 1}`).not.toBe('recovery');
    }
  });

  it('gör veckan mellan loppen till specifik fas för det andra loppet', () => {
    const veckor = buildWeeks(P5);
    const vattern = weekOfRace(P5, 'vatternrundan');
    const mellanvecka = veckor[vattern];

    expect(mellanvecka?.phase).toBe('specific');
    expect(mellanvecka?.focusRaceId).toBe('vansbrosimningen');
  });

  it('rör inte lopp som ligger fyra veckor eller mer isär', () => {
    const isär: PlanInput = {
      ...P2,
      races: [
        { id: 'vasaloppet', date: '2027-03-07' },
        { id: 'vatternrundan', date: '2027-06-18' },
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
    expect(vattern?.recoveryWeeks).toBe(0);
    expect(vansbro?.taperWeeks).toBe(1);
  });
});

describe('R-27: flera lopp samma vecka', () => {
  const sammaVecka: PlanInput = {
    ...P5,
    races: [
      { id: 'vatternrundan', date: '2027-06-18' },
      { id: 'vansbrosimningen', date: '2027-06-20' },
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
