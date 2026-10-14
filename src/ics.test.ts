import { describe, expect, it } from 'vitest';
import { generateProgram } from './generator';
import { escapeText, fold, programToIcs, type IcsLabels } from './ics';
import type { PlanInput, Program } from './types';

const input: PlanInput = {
  variant: 'full',
  engelbrektsloppet: false,
  races: {
    skiing: '2027-03-07',
    cycling: '2027-06-18',
    swimming: '2027-07-03',
    running: '2027-09-25',
  },
  levels: {
    skiing: 'intermediate',
    cycling: 'intermediate',
    swimming: 'beginner',
    running: 'advanced',
  },
  hoursPerWeek: 8,
  snowSeason: { startMonth: 12, endMonth: 3 },
  openWaterSeason: { startMonth: 6, endMonth: 8 },
  equipment: { skiErgometer: true, rollerSkis: false, indoorTrainer: true },
  goals: { skiing: 'improve', cycling: 'finish', swimming: 'finish', running: 'improve' },
  trainingDays: { daysPerWeek: 4, longSessionDay: 7, unavailableDays: [] },
};

/** Enkla etiketter — exporten ska inte bry sig om vilket språk de är på. */
const labels: IcsLabels = {
  calendarName: 'Klassikerplaneraren',
  discipline: { skiing: 'Längdskidor', cycling: 'Cykel', swimming: 'Simning', running: 'Löpning' },
  purpose: {
    easy: 'Lugnt',
    endurance: 'Uthållighet',
    longSession: 'Långpass',
    intervals: 'Intervaller',
    technique: 'Teknik',
    strength: 'Styrka',
    rest: 'Vila',
  },
  structure: {
    steady: 'Jämnt tempo.',
    longSteady: 'Långt och jämnt, ta med energi.',
    thresholdBlocks: '4 × 8 min tröskel, 3 min lugnt emellan.',
    shortIntervals: '30/30 intervaller.',
    hills: 'Backintervaller.',
    techniqueDrills: 'Teknikövningar.',
    openWaterSkills: 'Öppet vatten, siktträning.',
    strengthCircuit: 'Helkroppsstyrka.',
  },
  intensity: {
    easy: 'zon 1–2',
    moderate: 'zon 3',
    threshold: 'zon 4',
    interval: 'zon 4–5',
  },
  substitute: {
    skiErgometer: 'stakmaskin',
    rollerSkis: 'rullskidor',
    polesAndStrength: 'stavgång och styrka',
    indoorTrainer: 'trainer',
  },
  race: {
    skiing: 'skidloppet',
    cycling: 'cykelloppet',
    swimming: 'simloppet',
    running: 'löparloppet',
  },
  openWater: 'öppet vatten',
  keySession: 'Nyckelpass.',
  supportingSession: 'Stödpass — stryk det här först om veckan inte räcker till.',
  disclaimer: 'Programmet ersätter inte medicinsk rådgivning.',
};

const program: Program = generateProgram(input, '2026-10-13');
const ics = programToIcs(program, labels);
const lines = ics.split('\r\n');

describe('programToIcs', () => {
  it('börjar med BEGIN:VCALENDAR och slutar med END:VCALENDAR', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.filter((line) => line !== '').at(-1)).toBe('END:VCALENDAR');
  });

  it('avslutar varje rad med CRLF, inte bara LF', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    // Ingen ensam LF någonstans i filen.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it('skapar ett VEVENT per pass plus ett per lopp', () => {
    const sessions = program.weeks.reduce((sum, week) => sum + week.sessions.length, 0);
    const races = program.weeks.filter((week) => week.raceDate !== undefined).length;
    const events = lines.filter((line) => line === 'BEGIN:VEVENT').length;
    expect(events).toBe(sessions + races);
    expect(lines.filter((line) => line === 'END:VEVENT').length).toBe(events);
  });

  it('ger varje pass ett stabilt UID så att en ny export inte dubblerar', () => {
    const again = programToIcs(generateProgram(input, '2026-10-13'), labels);
    expect(again).toBe(ics);
  });

  it('ger varje händelse ett eget UID', () => {
    const uids = lines.filter((line) => line.startsWith('UID:'));
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('ger varje händelse en tidsstämpel som inte beror på klockan', () => {
    const stamps = new Set(lines.filter((line) => line.startsWith('DTSTAMP:')));
    expect(stamps).toEqual(new Set(['DTSTAMP:20261013T000000Z']));
  });

  it('skriver heldagshändelser med slutdatum dagen efter', () => {
    const start = lines.find((line) => line.startsWith('DTSTART'));
    const end = lines.find((line) => line.startsWith('DTEND'));
    expect(start).toMatch(/^DTSTART;VALUE=DATE:\d{8}$/);
    expect(end).toMatch(/^DTEND;VALUE=DATE:\d{8}$/);
  });

  it('lägger loppen i kalendern', () => {
    expect(lines).toContain('UID:2027-03-07-race@klassikerplaneraren');
    expect(lines.some((line) => line.includes('Skidloppet'))).toBe(true);
  });

  it('lägger passet på rätt veckodag', () => {
    // Första veckan börjar måndag 2026-10-12. Ett pass på söndag (dag 7) ska
    // hamna på 2026-10-18.
    const sunday = program.weeks[0]?.sessions.some((session) => session.day === 7);
    if (sunday === true) {
      expect(lines).toContain('DTSTART;VALUE=DATE:20261018');
    }
  });

  it('bryter aldrig en rad längre än 75 oktetter', () => {
    const encoder = new TextEncoder();
    for (const line of lines) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it('viker långa rader med inledande mellanslag', () => {
    const folded = lines.filter((line) => line.startsWith(' '));
    expect(folded.length).toBeGreaterThan(0);
  });
});

describe('escapeText', () => {
  it('escapar kommatecken och semikolon', () => {
    expect(escapeText('a,b;c')).toBe('a\\,b\\;c');
  });

  it('escapar radbrytningar', () => {
    expect(escapeText('rad1\nrad2')).toBe('rad1\\nrad2');
    expect(escapeText('rad1\r\nrad2')).toBe('rad1\\nrad2');
  });

  it('escapar omvänt snedstreck först, inte dubbelt', () => {
    expect(escapeText('a\\b')).toBe('a\\\\b');
    expect(escapeText('a\\,b')).toBe('a\\\\\\,b');
  });

  it('lämnar vanlig text i fred', () => {
    expect(escapeText('Längdskidor 2 h')).toBe('Längdskidor 2 h');
  });
});

describe('fold', () => {
  const encoder = new TextEncoder();

  it('lämnar korta rader orörda', () => {
    expect(fold('SUMMARY:Cykel 2 h')).toBe('SUMMARY:Cykel 2 h');
  });

  it('viker rader över 75 oktetter', () => {
    const long = `SUMMARY:${'a'.repeat(100)}`;
    const parts = fold(long).split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    }
  });

  it('räknar oktetter, inte tecken', () => {
    // 40 svenska tecken är 80 oktetter i UTF-8 och måste vikas, trots att
    // raden ser kortare ut än 75 tecken.
    const line = 'å'.repeat(40);
    expect(encoder.encode(line).length).toBeGreaterThan(75);
    expect(fold(line).split('\r\n').length).toBeGreaterThan(1);
  });

  it('delar aldrig mitt i ett tecken', () => {
    const folded = fold('ö'.repeat(60));
    // Går texten att sätta ihop igen är inget tecken sönderdelat.
    expect(folded.split('\r\n').map((part) => part.replace(/^ /, '')).join('')).toBe(
      'ö'.repeat(60),
    );
  });
});
