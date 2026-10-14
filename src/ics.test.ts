import { describe, expect, it } from 'vitest';
import { programToIcs } from './ics';
import type { Program } from './types';

const program: Program = {
  version: 1,
  createdAt: '2026-01-05',
  input: {
    variant: 'full',
    engelbrektsloppet: false,
    races: {
      skiing: '2027-03-07',
      cycling: '2026-06-19',
      swimming: '2026-07-04',
      running: '2026-09-26',
    },
    levels: {
      skiing: 'beginner',
      cycling: 'intermediate',
      swimming: 'beginner',
      running: 'advanced',
    },
    hoursPerWeek: 6,
    snowSeason: { startMonth: 12, endMonth: 3 },
    openWaterSeason: { startMonth: 6, endMonth: 8 },
    equipment: { skiErgometer: true, rollerSkis: false, indoorTrainer: true },
    goals: { skiing: 'finish', cycling: 'improve', swimming: 'finish', running: 'time' },
    trainingDays: { daysPerWeek: 4, longSessionDay: 7, unavailableDays: [] },
  },
  blocks: [],
  weeks: [],
  warnings: [],
};

describe('programToIcs', () => {
  // Ta bort det här testet när exporten är implementerad.
  it('är inte implementerad än och säger det tydligt', () => {
    expect(() => programToIcs(program)).toThrow(/inte implementerad/i);
  });

  it.todo('börjar med BEGIN:VCALENDAR och slutar med END:VCALENDAR');
  it.todo('skapar ett VEVENT per pass');
  it.todo('ger varje pass ett stabilt UID så att en ny export inte dubblerar händelser');
  it.todo('escapar kommatecken och radbrytningar i texter');
  it.todo('bryter rader längre än 75 oktetter enligt RFC 5545');
});
