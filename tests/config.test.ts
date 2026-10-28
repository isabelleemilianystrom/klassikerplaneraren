import { describe, expect, it } from 'vitest';
import { races, raceById, nextRaceDate, rules, sessions } from '../src/engine/config';
import type { SessionType, Sport } from '../src/engine/types';

/**
 * Konfigurationen validerar redan mot sina scheman när modulen laddas — går
 * importen igenom är den formellt riktig. Testerna här kontrollerar något
 * annat: att innehållet stämmer med kravspecens avsnitt 5. Ett schema fångar
 * att en siffra är ett tal, inte att det är rätt tal.
 */

describe('config/races.json', () => {
  it('har alla fyra loppen', () => {
    expect(races.races.map((race) => race.id)).toEqual([
      'vasaloppet',
      'vatternrundan',
      'vansbrosimningen',
      'lidingoloppet',
    ]);
  });

  it('har de datum som beslutades i fråga 1', () => {
    expect(raceById('vasaloppet').dates).toContain('2027-03-07');
    expect(raceById('vatternrundan').dates).toContain('2027-06-18');
    expect(raceById('vansbrosimningen').dates).toContain('2027-07-10');
    expect(raceById('lidingoloppet').dates).toContain('2027-09-25');
  });

  it('har loppdatumen i kronologisk ordning och utan dubbletter', () => {
    for (const race of races.races) {
      expect([...race.dates].sort(), race.id).toEqual(race.dates);
      expect(new Set(race.dates).size, race.id).toBe(race.dates.length);
    }
  });

  it('förifyller nästa datum på eller efter startdatumet', () => {
    // Höststart: alla fyra loppen ligger framåt i tiden.
    expect(nextRaceDate('vasaloppet', '2026-11-02')).toBe('2027-03-07');
    expect(nextRaceDate('lidingoloppet', '2026-11-02')).toBe('2027-09-25');

    // Loppdagen själv räknas som framåt, inte som passerad.
    expect(nextRaceDate('vasaloppet', '2027-03-07')).toBe('2027-03-07');
  });

  it('förifyller ingenting när inget publicerat datum passar', () => {
    // Vårstart 2027: Vasaloppet i mars har redan gått. Arrangören har inte
    // publicerat 2028 än, så fältet ska lämnas tomt — aldrig förifyllas med
    // ett datum som har varit, eftersom K-02 underkänner sådana.
    expect(nextRaceDate('vasaloppet', '2027-05-03')).toBeNull();
  });

  it('har distanserna från lopptabellen', () => {
    expect(raceById('vasaloppet').distanceKm).toBe(90);
    expect(raceById('vatternrundan').distanceKm).toBe(315);
    expect(raceById('vansbrosimningen').distanceKm).toBe(3);
    expect(raceById('lidingoloppet').distanceKm).toBe(30);
  });

  it('har uppskattad tid för varje lopp, som R-25 behöver', () => {
    expect(raceById('vasaloppet').estimatedHours).toBe(7);
    expect(raceById('vatternrundan').estimatedHours).toBe(11);
    expect(raceById('vansbrosimningen').estimatedHours).toBe(1);
    expect(raceById('lidingoloppet').estimatedHours).toBe(3.5);
  });

  it('ger två återhämtningsveckor efter lopp på fem timmar eller mer', () => {
    for (const race of races.races) {
      const förväntat = race.estimatedHours >= 5 ? 2 : 1;
      expect(race.recoveryWeeks).toBe(förväntat);
    }
  });

  it('har alla loppen inom tolv månader, som en klassiker kräver', () => {
    const datum = races.races.map((race) => race.dates[0] as string).sort();
    const första = new Date(`${datum[0] as string}T00:00:00Z`);
    const sista = new Date(`${datum.at(-1) as string}T00:00:00Z`);
    const månader = (sista.getTime() - första.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    expect(månader).toBeLessThanOrEqual(rules.classicWindow.months);
  });

  it('säger var datumen kommer ifrån och när de kontrollerades', () => {
    expect(races.source.length).toBeGreaterThan(0);
    expect(races.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('config/rules.json', () => {
  it('har veckotiderna från R-05', () => {
    expect(rules.weekTime.phaseShare.base).toBe(0.75);
    expect(rules.weekTime.phaseShare.specific).toBe(1);
    expect(rules.weekTime.phaseShare.recovery).toBe(0.5);
    expect(rules.weekTime.taperShare.firstWeek).toBe(0.6);
    expect(rules.weekTime.taperShare.secondWeek).toBe(0.4);
    expect(rules.weekTime.taperShare.singleWeek).toBe(0.5);
  });

  it('har avlastningsveckan från R-06 och de första veckorna från R-07', () => {
    expect(rules.weekTime.deload.everyNthWeek).toBe(4);
    expect(rules.weekTime.deload.share).toBe(0.7);
    expect(rules.weekTime.firstWeeks.count).toBe(2);
    expect(rules.weekTime.firstWeeks.maxShare).toBe(0.6);
  });

  it('fördelar hela veckan oavsett antal sporter (R-08)', () => {
    const { specific } = rules.sportSplit;
    expect(specific.raceSportShare).toBe(0.55);
    expect(specific.raceSportShareWhenTwoSports).toBe(0.65);
    // Med en enda sport får den allt — annars hade en andel blivit ofördelad.
    expect(specific.raceSportShareWhenOneSport).toBe(1);
  });

  it('har träningsdagarna från R-11 i stigande ordning', () => {
    const steg = rules.trainingDays.byHoursPerWeek;
    expect(steg.map((s) => s.days)).toEqual([4, 5, 6]);
    for (let i = 1; i < steg.length; i += 1) {
      expect((steg[i] as { upToHours: number }).upToHours).toBeGreaterThan(
        (steg[i - 1] as { upToHours: number }).upToHours,
      );
    }
    // R-11 kräver minst en hel vilodag, så aldrig sju träningsdagar.
    expect(Math.max(...steg.map((s) => s.days))).toBeLessThanOrEqual(6);
  });

  it('har passlängderna från R-12 och långpasstaken från R-13', () => {
    expect(rules.session.minMinutes).toBe(20);
    expect(rules.session.maxMinutes).toBe(300);
    expect(rules.longSession.capMinutesBySport).toEqual({
      ski: 240,
      bike: 300,
      run: 150,
      swim: 75,
    });
  });

  it('låter inget långpass överstiga passtaket i R-12', () => {
    for (const minuter of Object.values(rules.longSession.capMinutesBySport)) {
      expect(minuter).toBeLessThanOrEqual(rules.session.maxMinutes);
      expect(minuter).toBeGreaterThanOrEqual(rules.session.minMinutes);
    }
  });

  it('begränsar långpasset till en andel av veckan (R-28)', () => {
    expect(rules.longSession.maxShareOfWeek).toBe(0.7);
  });

  it('lägger långpasset på helgen (R-13)', () => {
    expect(rules.longSession.allowedWeekdays).toEqual([6, 7]);
  });

  it('har zontexterna ordagrant från avsnitt 5', () => {
    expect(rules.intensity.zoneText['2']).toBe('Lugnt – du ska kunna prata hela meningar');
    expect(rules.intensity.zoneText['4']).toBe('Hårt – bara några ord i taget');
  });

  it('håller intensiteten nere i återhämtning och uppe i specifik fas (R-15)', () => {
    expect(rules.intensity.byPhase.recovery.maxZone).toBe(2);
    expect(rules.intensity.byPhase.specific.maxZone).toBe(4);
    // Nivå Ny får aldrig zon 4, ens i specifik fas.
    expect(rules.intensity.byPhase.specific.maxZoneForNewLevel).toBe(3);
  });

  it('planerar öppet vatten bara under sommaren (R-19)', () => {
    expect(rules.season.openWaterMonths).toEqual([6, 7, 8]);
  });

  it('har varningstexterna ordagrant från R-22 till R-24 och R-26', () => {
    expect(rules.warnings.shortPreparation.text).toBe(
      'Du har kort tid att förbereda dig. Planen är försiktig – sikta på att genomföra, inte på tid.',
    );
    expect(rules.warnings.lowHours.text).toBe(
      'Den tid du har valt är i minsta laget för dina lopp.',
    );
    expect(rules.warnings.skiTechnique.text).toBe(
      'Teknik är avgörande i Vasaloppet. Försök att åka på snö eller gå en skidkurs före loppet.',
    );
    expect(rules.warnings.outsideClassicWindow.text).toContain('tolv månader');
  });

  it('har en regelversion som kan sparas i planen', () => {
    expect(rules.rulesVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('config/sessions.json', () => {
  const alla: SessionType[] = [
    'easy',
    'long',
    'tempo',
    'intervals',
    'technique',
    'strength',
    'rest',
    'race',
  ];

  it('har en titel och en instruktion för varje passtyp (R-30)', () => {
    for (const typ of alla) {
      const post = sessions.types[typ];
      expect(post, `passtypen ${typ} saknas`).toBeDefined();
      expect(post?.title.length).toBeGreaterThan(0);
      expect(post?.instruction.length).toBeGreaterThan(0);
    }
  });

  it('har inga passtyper utöver dem motorn kan producera', () => {
    expect(Object.keys(sessions.types).sort()).toEqual([...alla].sort());
  });

  it('har ersättningar för varje gren som kan sakna utrustning (R-17, R-18, R-20)', () => {
    for (const nyckel of ['ski.skiErg', 'ski.poleWalk', 'swim.dryland', 'bike.indoor']) {
      expect(sessions.substitutes[nyckel], `ersättningen ${nyckel} saknas`).toBeDefined();
    }
  });

  it('har säkerhetstexten för öppet vatten ordagrant från avsnitt 8', () => {
    expect(sessions.safetyNotes.openWater.text).toBe(
      'Simma aldrig ensam i öppet vatten. Använd en synlig boj och gå i gradvis – kallt vatten kan ge köldchock.',
    );
  });

  it('har styrkeövningar för de kroppsdelar R-10 nämner', () => {
    const fokus = new Set(sessions.strengthExercises.exercises.map((övning) => övning.focus));
    for (const del of ['bål', 'höft', 'vader', 'axlar']) {
      expect(fokus, `övning för ${del} saknas`).toContain(del);
    }
  });

  it('lovar ingenting medicinskt i instruktionerna', () => {
    // Skrivreglerna i avsnitt 8: inga påståenden om att träningen förebygger
    // skador, behandlar eller rehabiliterar.
    const förbjudet = /förebygger skad|behandlar|rehabiliter|botar|läker/i;
    const texter = [
      ...Object.values(sessions.types),
      ...Object.values(sessions.sportVariants),
      ...Object.values(sessions.substitutes),
    ];
    for (const post of texter) {
      expect(post.instruction, post.title).not.toMatch(förbjudet);
    }
  });
});

describe('konfigurationen hänger ihop', () => {
  it('har ett långpasstak för varje gren som har ett lopp', () => {
    const grenar = races.races.map((race) => race.sport as Exclude<Sport, 'strength'>);
    for (const gren of grenar) {
      expect(rules.longSession.capMinutesBySport[gren], `tak saknas för ${gren}`).toBeDefined();
    }
  });

  it('nämner bara lopp som finns i varningen om låga timmar', () => {
    const idn = races.races.map((race) => race.id);
    for (const id of rules.warnings.lowHours.longRaceIds) {
      expect(idn).toContain(id);
    }
  });
});
