import { describe, expect, it } from 'vitest';
import type { RaceDates } from '../types';
import { daysBetween, isMonday } from './dates';
import { buildTimeline, lastRaceDate, requireFutureRaces, weekIndexOf } from './timeline';

const today = '2026-10-13'; // en tisdag

/** En hel klassiker framför sig: skidor först, löpningen sist. */
const races: RaceDates = {
  skiing: '2027-03-07',
  cycling: '2027-06-18',
  swimming: '2027-07-03',
  running: '2027-09-25',
};

describe('lastRaceDate', () => {
  it('hittar loppet som ligger sist, oavsett ordning i objektet', () => {
    expect(lastRaceDate(races)).toBe('2027-09-25');
  });

  it('kastar ett fel som namnger grenen vid ogiltigt datum', () => {
    expect(() => lastRaceDate({ ...races, swimming: '2027-07-32' })).toThrow(/swimming/);
  });
});

describe('requireFutureRaces', () => {
  it('släpper igenom lopp som ligger framåt', () => {
    expect(() => requireFutureRaces(races, today)).not.toThrow();
  });

  it('godtar ett lopp samma dag som i dag', () => {
    expect(() => requireFutureRaces({ ...races, skiing: today }, today)).not.toThrow();
  });

  it('kastar för ett enda passerat lopp, även när de andra ligger framåt', () => {
    expect(() => requireFutureRaces({ ...races, cycling: '2026-06-19' }, today)).toThrow(
      /2026-06-19/,
    );
  });

  it('räknar upp alla passerade datum', () => {
    const error = (): void =>
      requireFutureRaces({ ...races, cycling: '2026-06-19', swimming: '2026-07-04' }, today);
    expect(error).toThrow(/2026-06-19/);
    expect(error).toThrow(/2026-07-04/);
  });
});

describe('buildTimeline', () => {
  it('börjar på måndagen i veckan som innehåller dagens datum', () => {
    expect(buildTimeline(races, today)[0]).toBe('2026-10-12');
  });

  it('slutar på måndagen i veckan som innehåller det sista loppet', () => {
    // 2027-09-25 är en lördag, i veckan som börjar 2027-09-20.
    expect(buildTimeline(races, today).at(-1)).toBe('2027-09-20');
  });

  it('ger bara måndagar', () => {
    for (const week of buildTimeline(races, today)) {
      expect(isMonday(week)).toBe(true);
    }
  });

  it('lägger veckorna i ordning med exakt sju dagar mellan', () => {
    const timeline = buildTimeline(races, today);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(daysBetween(timeline[i - 1] as string, timeline[i] as string)).toBe(7);
    }
  });

  it('har inga dubbletter', () => {
    const timeline = buildTimeline(races, today);
    expect(new Set(timeline).size).toBe(timeline.length);
  });

  it('täcker hela perioden fram till det sista loppet', () => {
    expect(buildTimeline(races, today)).toHaveLength(50);
  });

  it('ger en enda vecka när alla lopp ligger i samma vecka som i dag', () => {
    const sameWeek: RaceDates = {
      skiing: '2026-10-14',
      cycling: '2026-10-15',
      swimming: '2026-10-16',
      running: '2026-10-17',
    };
    expect(buildTimeline(sameWeek, today)).toEqual(['2026-10-12']);
  });

  it('tar med loppveckan även när loppet är i dag', () => {
    const allToday: RaceDates = {
      skiing: today,
      cycling: today,
      swimming: today,
      running: today,
    };
    expect(buildTimeline(allToday, today)).toEqual(['2026-10-12']);
  });

  it('kastar när ett lopp redan har varit', () => {
    expect(() => buildTimeline({ ...races, cycling: '2026-09-01' }, today)).toThrow(/redan/);
  });

  it('kastar vid ogiltigt dagens datum', () => {
    expect(() => buildTimeline(races, 'i dag')).toThrow(/Dagens datum/);
  });
});

describe('weekIndexOf', () => {
  it('hittar veckan ett lopp ligger i', () => {
    const timeline = buildTimeline(races, today);
    expect(weekIndexOf(timeline, '2027-09-25')).toBe(timeline.length - 1);
    expect(weekIndexOf(timeline, today)).toBe(0);
    expect(weekIndexOf(timeline, '2027-03-07')).toBe(20);
  });

  it('ger -1 för ett datum utanför tidslinjen', () => {
    expect(weekIndexOf(buildTimeline(races, today), '2026-01-01')).toBe(-1);
  });
});
