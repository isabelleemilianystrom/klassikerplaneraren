import { describe, expect, it } from 'vitest';
import { isIsoDate } from './generator/dates';
import { SCHEDULE_CHECKED, SUGGESTED_RACE_DATES, suggestedRaceDate, upcomingSuggestions } from './race-schedule';
import { DISCIPLINES, type ClassicVariant } from './types';
import { VARIANTS } from './variants';

describe('SUGGESTED_RACE_DATES', () => {
  it('innehåller bara giltiga ISO-datum', () => {
    for (const variant of VARIANTS) {
      for (const date of Object.values(SUGGESTED_RACE_DATES[variant])) {
        expect(isIsoDate(date)).toBe(true);
      }
    }
  });

  it('har ett datum per gren för den hela klassikern', () => {
    for (const discipline of DISCIPLINES) {
      expect(suggestedRaceDate('full', discipline)).toBeDefined();
    }
  });

  it('har inga datum före kontrolldatumet', () => {
    for (const variant of VARIANTS) {
      for (const date of Object.values(SUGGESTED_RACE_DATES[variant])) {
        expect(date >= SCHEDULE_CHECKED).toBe(true);
      }
    }
  });

  it('håller den hela klassikerns lopp inom tolv månader', () => {
    const dates = Object.values(SUGGESTED_RACE_DATES['full']).sort();
    const first = dates[0] as string;
    const last = dates.at(-1) as string;
    const twelveMonthsLater = `${Number(first.slice(0, 4)) + 1}${first.slice(4)}`;
    expect(last <= twelveMonthsLater).toBe(true);
  });

  it('ger samma datum för korta och tjej, som har samma lopp', () => {
    expect(SUGGESTED_RACE_DATES['short']).toEqual(SUGGESTED_RACE_DATES['women']);
  });

  it('saknar hellre datum än gissar', () => {
    // Halva klassikern har bara simningen belagd. Om någon lägger till fler
    // datum ska det vara ett medvetet val med källa i race-schedule.ts.
    expect(Object.keys(SUGGESTED_RACE_DATES['half'])).toEqual(['swimming']);
  });
});

describe('upcomingSuggestions', () => {
  const before: ClassicVariant = 'full';

  it('ger alla förslag när de ligger framåt', () => {
    expect(upcomingSuggestions(before, '2026-10-13')).toEqual(SUGGESTED_RACE_DATES['full']);
  });

  it('utelämnar förslag som redan passerat', () => {
    const upcoming = upcomingSuggestions(before, '2027-07-01');
    expect(upcoming.skiing).toBeUndefined();
    expect(upcoming.cycling).toBeUndefined();
    expect(upcoming.swimming).toBe('2027-07-10');
    expect(upcoming.running).toBe('2027-09-25');
  });

  it('tar med ett lopp som går i dag', () => {
    expect(upcomingSuggestions(before, '2027-03-07').skiing).toBe('2027-03-07');
  });

  it('ger inget alls när alla förslag är gamla', () => {
    expect(upcomingSuggestions(before, '2028-01-01')).toEqual({});
  });
});
