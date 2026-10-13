import { describe, expect, it } from 'vitest';
import type { Discipline, RaceDates } from '../types';
import { startOfWeek } from './dates';
import { assignPhases, DELOAD_EVERY, PEAK_WEEKS, type PhasedWeek } from './phases';
import { buildTimeline } from './timeline';

const today = '2026-10-13';

/** En hel klassiker: skidor mars, cykel juni, sim juli, löpning september. */
const races: RaceDates = {
  skiing: '2027-03-07',
  cycling: '2027-06-18',
  swimming: '2027-07-03',
  running: '2027-09-25',
};

/** Gott om tid mellan loppen: varje lopp hinner få en egen toppning. */
const spacedRaces: RaceDates = {
  skiing: '2027-03-07',
  cycling: '2027-06-18',
  swimming: '2027-07-25',
  running: '2027-09-25',
};

/** Två lopp tätt ihop: bara två veckor mellan cykel och simning. */
const tightRaces: RaceDates = {
  skiing: '2027-03-07',
  cycling: '2027-06-18',
  swimming: '2027-06-26',
  running: '2027-09-25',
};

function plan(input: RaceDates = races, from: string = today): PhasedWeek[] {
  return assignPhases(buildTimeline(input, from), input);
}

function weekOf(weeks: readonly PhasedWeek[], date: string): PhasedWeek {
  const week = weeks.find((candidate) => candidate.startDate === startOfWeek(date));
  if (week === undefined) throw new Error(`Ingen vecka för ${date}`);
  return week;
}

describe('assignPhases', () => {
  it('ger varje vecka i tidslinjen en fas', () => {
    const timeline = buildTimeline(races, today);
    const weeks = assignPhases(timeline, races);
    expect(weeks).toHaveLength(timeline.length);
    expect(weeks.map((week) => week.startDate)).toEqual([...timeline]);
  });

  it('gör varje loppvecka till en nedtrappningsvecka', () => {
    const weeks = plan();
    for (const date of Object.values(races)) {
      expect(weekOf(weeks, date).phase).toBe('taper');
    }
  });

  it('lägger återhämtning veckan efter varje lopp', () => {
    const weeks = plan();
    for (const date of Object.values(races)) {
      const raceWeek = weeks.findIndex((week) => week.startDate === startOfWeek(date));
      expect(weeks[raceWeek + 1]?.phase).toBe('recovery');
    }
  });

  it('behåller nedtrappning även när nästa lopp ligger tätt efter', () => {
    const weeks = plan(tightRaces);
    expect(weekOf(weeks, '2027-06-18').phase).toBe('taper');
    expect(weekOf(weeks, '2027-06-26').phase).toBe('taper');
  });

  it('flaggar en loppvecka direkt efter ett lopp som återhämtning', () => {
    // Veckan 21–27 juni innehåller simloppet och ligger direkt efter cykelloppet.
    // Fasen måste bli taper, men veckan ska ändå vara lättare än en vanlig taper.
    const week = weekOf(plan(tightRaces), '2027-06-26');
    expect(week.phase).toBe('taper');
    expect(week.followsRace).toBe(true);
  });

  it('flaggar inte en vanlig vecka som att den följer ett lopp', () => {
    expect(weekOf(plan(), '2026-10-13').followsRace).toBe(false);
  });

  it('toppar formen mot varje lopp som har veckor nog före sig', () => {
    const weeks = plan(spacedRaces);
    for (const discipline of Object.keys(spacedRaces) as Discipline[]) {
      const peaks = weeks.filter(
        (week) => week.phase === 'peak' && week.targetRace === discipline,
      );
      expect(peaks.length).toBeGreaterThan(0);
    }
  });

  it('hoppar över toppningen när nästa lopp ligger för nära', () => {
    // Två veckor mellan loppen räcker inte till en toppning — veckan däremellan
    // behövs för återhämtning. Det är avsiktligt, inte en lucka i modellen.
    const weeks = plan(tightRaces);
    const peaks = weeks.filter(
      (week) => week.phase === 'peak' && week.targetRace === 'swimming',
    );
    expect(peaks).toHaveLength(0);
  });

  it('siktar varje vecka mot nästa lopp som kommer', () => {
    const weeks = plan();
    expect(weekOf(weeks, '2026-10-13').targetRace).toBe('skiing');
    expect(weekOf(weeks, '2027-03-15').targetRace).toBe('cycling');
    expect(weekOf(weeks, '2027-06-21').targetRace).toBe('swimming');
    expect(weekOf(weeks, '2027-07-05').targetRace).toBe('running');
  });

  it('toppar de sista veckorna före varje lopp', () => {
    const weeks = plan();
    const raceWeek = weeks.findIndex((week) => week.startDate === startOfWeek(races.skiing));
    for (let i = 1; i <= PEAK_WEEKS; i += 1) {
      expect(weeks[raceWeek - i]?.phase).toBe('peak');
    }
  });

  it('börjar långt från loppet med uppbyggnad', () => {
    expect(plan()[0]?.phase).toBe('base');
  });

  it('lägger in en lugnare vecka med jämna mellanrum i uppbyggnaden', () => {
    const weeks = plan();
    // Fram till toppningen före första loppet ska ingen svit av hårda veckor
    // vara längre än DELOAD_EVERY.
    let streak = 0;
    for (const week of weeks) {
      if (week.phase === 'base' || week.phase === 'build') {
        streak += 1;
        expect(streak).toBeLessThanOrEqual(DELOAD_EVERY);
      } else {
        streak = 0;
      }
    }
  });

  it('bryter inte toppningen med en nedtrappningsvecka', () => {
    const weeks = plan();
    const raceWeek = weeks.findIndex((week) => week.startDate === startOfWeek(races.running));
    for (let i = 1; i <= PEAK_WEEKS; i += 1) {
      expect(weeks[raceWeek - i]?.phase).not.toBe('recovery');
    }
  });

  it('avslutar programmet med återhämtning efter sista loppet', () => {
    const weeks = plan();
    expect(weeks.at(-1)?.phase).toBe('recovery');
  });

  it('låter det första loppet äga veckan när två lopp går samma vecka', () => {
    const sameWeek: RaceDates = {
      skiing: '2027-03-07',
      cycling: '2027-06-18',
      swimming: '2027-06-19',
      running: '2027-09-25',
    };
    expect(weekOf(plan(sameWeek), '2027-06-18').targetRace).toBe('cycling');
  });

  it('använder bara kända faser', () => {
    const allowed = new Set(['base', 'build', 'peak', 'taper', 'recovery']);
    for (const week of plan()) {
      expect(allowed.has(week.phase)).toBe(true);
    }
  });
});
