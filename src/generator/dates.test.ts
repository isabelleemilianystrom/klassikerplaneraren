import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWeeks,
  daysBetween,
  earliest,
  isIsoDate,
  isMonday,
  latest,
  requireIsoDate,
  startOfWeek,
} from './dates';

describe('isIsoDate', () => {
  it('godtar riktiga datum', () => {
    expect(isIsoDate('2026-10-13')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true); // skottår
  });

  it('avvisar fel form', () => {
    expect(isIsoDate('2026-10-13T00:00:00Z')).toBe(false);
    expect(isIsoDate('13/10/2026')).toBe(false);
    expect(isIsoDate('2026-1-3')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('avvisar datum som inte finns', () => {
    expect(isIsoDate('2027-02-29')).toBe(false); // inte skottår
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
  });
});

describe('requireIsoDate', () => {
  it('returnerar datumet när det är giltigt', () => {
    expect(requireIsoDate('2026-06-19', 'Cykelloppet')).toBe('2026-06-19');
  });

  it('kastar ett fel som namnger fältet', () => {
    expect(() => requireIsoDate('nej', 'Cykelloppet')).toThrow(/Cykelloppet/);
  });
});

describe('addDays', () => {
  it('går framåt och bakåt', () => {
    expect(addDays('2026-10-13', 1)).toBe('2026-10-14');
    expect(addDays('2026-10-13', -1)).toBe('2026-10-12');
    expect(addDays('2026-10-13', 0)).toBe('2026-10-13');
  });

  it('går över månadsskifte', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('går över årsskifte', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('hanterar skottdagen', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('hoppar inte fel dygn över sommartidsskiftet', () => {
    // Sista söndagen i mars respektive oktober, när klockan ställs om i Sverige.
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(addDays('2027-10-30', 1)).toBe('2027-10-31');
  });
});

describe('addWeeks', () => {
  it('lägger till sju dagar per vecka', () => {
    expect(addWeeks('2026-10-12', 1)).toBe('2026-10-19');
    expect(addWeeks('2026-10-12', 52)).toBe('2027-10-11');
  });
});

describe('daysBetween', () => {
  it('räknar dygn framåt', () => {
    expect(daysBetween('2026-10-13', '2026-10-20')).toBe(7);
  });

  it('ger negativt tal bakåt', () => {
    expect(daysBetween('2026-10-20', '2026-10-13')).toBe(-7);
  });

  it('ger noll för samma dag', () => {
    expect(daysBetween('2026-10-13', '2026-10-13')).toBe(0);
  });

  it('räknar rätt över ett sommartidsskifte', () => {
    // Utan UTC skulle den här perioden bli 364,96 dygn och avrundas fel.
    expect(daysBetween('2026-10-13', '2027-10-13')).toBe(365);
  });
});

describe('startOfWeek', () => {
  it('ger måndagen i veckan', () => {
    // 2026-10-13 är en tisdag.
    expect(startOfWeek('2026-10-13')).toBe('2026-10-12');
  });

  it('låter en måndag vara', () => {
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
  });

  it('räknar söndag till veckan som börjat, inte den som kommer', () => {
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
  });

  it('går bakåt över årsskiftet', () => {
    // 2027-01-01 är en fredag.
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });
});

describe('isMonday', () => {
  it('känner igen måndagar', () => {
    expect(isMonday('2026-10-12')).toBe(true);
    expect(isMonday('2026-10-13')).toBe(false);
    expect(isMonday('2026-10-18')).toBe(false);
  });
});

describe('earliest och latest', () => {
  const dates = ['2026-06-19', '2027-03-07', '2026-07-04', '2026-09-26'];

  it('hittar första och sista datumet', () => {
    expect(earliest(dates)).toBe('2026-06-19');
    expect(latest(dates)).toBe('2027-03-07');
  });

  it('klarar en lista med ett datum', () => {
    expect(earliest(['2026-06-19'])).toBe('2026-06-19');
    expect(latest(['2026-06-19'])).toBe('2026-06-19');
  });

  it('kastar för en tom lista', () => {
    expect(() => earliest([])).toThrow(/tom/);
    expect(() => latest([])).toThrow(/tom/);
  });
});
