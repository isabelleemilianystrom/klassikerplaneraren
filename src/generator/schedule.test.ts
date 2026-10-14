import { describe, expect, it } from 'vitest';
import type { TrainingDays, Weekday } from '../types';
import { availableDays, preferredLongDay, trainingDaysOfWeek, weekdayDistance } from './schedule';

const standard: TrainingDays = { daysPerWeek: 4, longSessionDay: 7, unavailableDays: [] };

describe('weekdayDistance', () => {
  it('mäter avstånd runt veckan', () => {
    expect(weekdayDistance(1, 3)).toBe(2);
    // Måndag och söndag ligger bredvid varandra, inte sex dagar isär.
    expect(weekdayDistance(1, 7)).toBe(1);
    expect(weekdayDistance(4, 4)).toBe(0);
  });
});

describe('availableDays', () => {
  it('tar bort dagarna användaren inte kan träna', () => {
    expect(availableDays({ ...standard, unavailableDays: [1, 2] })).toEqual([3, 4, 5, 6, 7]);
  });
});

describe('preferredLongDay', () => {
  it('ger den önskade dagen när den går', () => {
    expect(preferredLongDay(standard)).toBe(7);
  });

  it('flyttar till närmaste möjliga dag när den önskade är upptagen', () => {
    // Söndag önskas men är omöjlig: lördag ligger närmast.
    expect(preferredLongDay({ ...standard, unavailableDays: [7] })).toBe(6);
  });

  it('räknar runt veckan när den letar närmaste dag', () => {
    // Bara måndag och tisdag är möjliga; måndag ligger en dag från söndag.
    expect(preferredLongDay({ ...standard, unavailableDays: [3, 4, 5, 6, 7] })).toBe(1);
  });
});

describe('trainingDaysOfWeek', () => {
  it('börjar med långpassets dag', () => {
    expect(trainingDaysOfWeek(standard, 4)[0]).toBe(7);
  });

  it('ger aldrig fler dagar än användaren angett', () => {
    expect(trainingDaysOfWeek({ ...standard, daysPerWeek: 3 }, 5)).toHaveLength(3);
  });

  it('ger aldrig fler dagar än antalet pass', () => {
    expect(trainingDaysOfWeek(standard, 2)).toHaveLength(2);
  });

  it('använder aldrig en omöjlig dag', () => {
    const days = trainingDaysOfWeek({ ...standard, unavailableDays: [1, 3, 5] }, 4);
    for (const day of days) {
      expect([1, 3, 5]).not.toContain(day);
    }
  });

  it('sprider passen i stället för att klumpa ihop dem', () => {
    const days = trainingDaysOfWeek({ ...standard, daysPerWeek: 3 }, 3);
    // Tre pass på en vecka ska ligga minst två dagar isär.
    const sorted = [...days].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      expect((sorted[i] as Weekday) - (sorted[i - 1] as Weekday)).toBeGreaterThanOrEqual(2);
    }
  });

  it('ger inga dagar alls när ingen dag är möjlig', () => {
    expect(
      trainingDaysOfWeek({ ...standard, unavailableDays: [1, 2, 3, 4, 5, 6, 7] }, 3),
    ).toEqual([]);
  });

  it('ger inga dubbletter', () => {
    const days = trainingDaysOfWeek({ ...standard, daysPerWeek: 6 }, 6);
    expect(new Set(days).size).toBe(days.length);
  });
});
