import { describe, expect, it } from 'vitest';
import type { RaceDates } from '../types';
import { isMonday, daysBetween } from './dates';
import { buildTimeline, lastRaceDate, weekIndexOf } from './timeline';

/** Loppdatum i den ordning de inträffar: cykel, sim, löpning, skidor. */
const races: RaceDates = {
  cycling: '2026-06-19',
  swimming: '2026-07-04',
  running: '2026-09-26',
  skiing: '2027-03-07',
};

const today = '2026-10-13'; // en tisdag
const beforeAllRaces = '2026-05-01';

describe('lastRaceDate', () => {
  it('hittar loppet som ligger sist, oavsett ordning i objektet', () => {
    expect(lastRaceDate(races)).toBe('2027-03-07');
  });

  it('kastar ett fel som namnger grenen vid ogiltigt datum', () => {
    expect(() => lastRaceDate({ ...races, swimming: '2026-07-32' })).toThrow(/swimming/);
  });
});

describe('buildTimeline', () => {
  it('börjar på måndagen i veckan som innehåller dagens datum', () => {
    const timeline = buildTimeline(races, today);
    expect(timeline[0]).toBe('2026-10-12');
  });

  it('slutar på måndagen i veckan som innehåller det sista loppet', () => {
    const timeline = buildTimeline(races, today);
    // 2027-03-07 är en söndag, alltså sista dagen i veckan som börjar 2027-03-01.
    expect(timeline.at(-1)).toBe('2027-03-01');
  });

  it('ger bara måndagar', () => {
    for (const week of buildTimeline(races, beforeAllRaces)) {
      expect(isMonday(week)).toBe(true);
    }
  });

  it('lägger veckorna i ordning med exakt sju dagar mellan', () => {
    const timeline = buildTimeline(races, beforeAllRaces);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(daysBetween(timeline[i - 1] as string, timeline[i] as string)).toBe(7);
    }
  });

  it('har inga dubbletter', () => {
    const timeline = buildTimeline(races, beforeAllRaces);
    expect(new Set(timeline).size).toBe(timeline.length);
  });

  it('täcker hela perioden fram till det sista loppet', () => {
    const timeline = buildTimeline(races, today);
    // 2026-10-12 till 2027-03-01 är 20 veckor, båda inklusive.
    expect(timeline).toHaveLength(21);
  });

  it('ger en enda vecka när sista loppet är i samma vecka som i dag', () => {
    const timeline = buildTimeline({ ...races, skiing: '2026-10-17' }, today);
    expect(timeline).toEqual(['2026-10-12']);
  });

  it('tar med loppveckan även när loppet är samma dag som i dag', () => {
    const timeline = buildTimeline({ ...races, skiing: today }, today);
    expect(timeline).toEqual(['2026-10-12']);
  });

  it('klarar en tidslinje över ett helt år', () => {
    const timeline = buildTimeline({ ...races, skiing: '2027-10-12' }, today);
    expect(timeline).toHaveLength(53);
  });

  it('kastar när det sista loppet redan har varit', () => {
    expect(() => buildTimeline(races, '2027-03-08')).toThrow(/redan varit/);
  });

  it('kastar vid ogiltigt dagens datum', () => {
    expect(() => buildTimeline(races, 'i dag')).toThrow(/Dagens datum/);
  });
});

describe('weekIndexOf', () => {
  it('hittar veckan ett lopp ligger i', () => {
    const timeline = buildTimeline(races, today);
    expect(weekIndexOf(timeline, '2027-03-07')).toBe(timeline.length - 1);
    expect(weekIndexOf(timeline, '2026-10-13')).toBe(0);
  });

  it('ger -1 för ett datum utanför tidslinjen', () => {
    expect(weekIndexOf(buildTimeline(races, today), '2026-01-01')).toBe(-1);
  });
});
