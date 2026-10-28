/**
 * Referensprofilerna P1–P5 från kravspecens avsnitt 9.
 *
 * Startdatum 2026-11-02 om inget annat anges. Profilerna är de planer Isabelle
 * granskar vid M1, och invarianterna ska gälla för allihop.
 */
import type { PlanInput } from '../src/engine/types.ts';

export const START_DATE = '2026-11-02';

/** Loppdatumen från config/races.json, som formuläret förifyller. */
const LOPP = {
  vasaloppet: '2027-03-07',
  vatternrundan: '2027-06-18',
  vansbrosimningen: '2027-07-10',
  lidingoloppet: '2027-09-25',
} as const;

/** Söndag långpass, måndag vila — det formuläret föreslår. */
const VANLIGA_DAGAR = { longSession: 7, rest: 1 } as const;

const INGEN_UTRUSTNING = {
  snowOrRollerSkis: false,
  skiErg: false,
  pool: false,
  bike: false,
} as const;

const ALLA_FYRA = [
  { id: 'vasaloppet' as const, date: LOPP.vasaloppet },
  { id: 'vatternrundan' as const, date: LOPP.vatternrundan },
  { id: 'vansbrosimningen' as const, date: LOPP.vansbrosimningen },
  { id: 'lidingoloppet' as const, date: LOPP.lidingoloppet },
];

/** P1 Förstagångsklassikern: alla fyra, 6 h, ny i skidor och simning. */
export const P1: PlanInput = {
  schemaVersion: 2,
  today: START_DATE,
  startDate: START_DATE,
  races: ALLA_FYRA,
  levels: { ski: 'new', swim: 'new', bike: 'experienced', run: 'experienced' },
  hoursPerWeek: 6,
  preferredDays: VANLIGA_DAGAR,
  equipment: { ...INGEN_UTRUSTNING, pool: true, bike: true },
};

/** P2 Tidsjägaren: alla fyra, 10 h, erfaren i allt, all utrustning. */
export const P2: PlanInput = {
  schemaVersion: 2,
  today: START_DATE,
  startDate: START_DATE,
  races: ALLA_FYRA,
  levels: { ski: 'advanced', swim: 'advanced', bike: 'advanced', run: 'advanced' },
  hoursPerWeek: 10,
  preferredDays: VANLIGA_DAGAR,
  equipment: { snowOrRollerSkis: true, skiErg: true, pool: true, bike: true },
};

/** P3 Den begränsade: alla fyra, 3 h, van i allt, bara cykel. */
export const P3: PlanInput = {
  schemaVersion: 2,
  today: START_DATE,
  startDate: START_DATE,
  races: ALLA_FYRA,
  levels: { ski: 'experienced', swim: 'experienced', bike: 'experienced', run: 'experienced' },
  hoursPerWeek: 3,
  preferredDays: VANLIGA_DAGAR,
  equipment: { ...INGEN_UTRUSTNING, bike: true },
};

/**
 * P4 Kort tid: bara Vasaloppet, sex veckor efter start, ingen utrustning.
 *
 * Loppdatumet är med flit inte det riktiga — profilen finns för att pröva kort
 * förberedelsetid (R-22), varningen om skidteknik (R-24) och en plan med en
 * enda sport (R-08).
 */
export const P4: PlanInput = {
  schemaVersion: 2,
  today: START_DATE,
  startDate: START_DATE,
  races: [{ id: 'vasaloppet', date: '2026-12-13' }],
  levels: { ski: 'new' },
  hoursPerWeek: 6,
  preferredDays: VANLIGA_DAGAR,
  equipment: INGEN_UTRUSTNING,
};

/**
 * P5 Lopp tätt: Vätternrundan och Vansbrosimningen två veckor isär.
 *
 * Prövar blocklogiken i R-03: det första loppet ska förlora sin
 * återhämtningsvecka och det andra få en veckas nedtrappning.
 */
export const P5: PlanInput = {
  schemaVersion: 2,
  today: START_DATE,
  startDate: START_DATE,
  races: [
    { id: 'vatternrundan', date: LOPP.vatternrundan },
    { id: 'vansbrosimningen', date: '2027-07-02' },
  ],
  levels: { bike: 'experienced', swim: 'experienced' },
  hoursPerWeek: 8,
  preferredDays: VANLIGA_DAGAR,
  equipment: { ...INGEN_UTRUSTNING, pool: true, bike: true },
};

/**
 * P6 Vårstart: klassikern börjad i maj, med Vasaloppet sist.
 *
 * En svensk klassiker går att börja när som helst på året — kravet är bara att
 * alla fyra loppen genomförs inom tolv månader. Den som börjar på våren tar
 * Vätternrundan, Vansbrosimningen och Lidingöloppet samma år och Vasaloppet
 * våren därpå. Profilen finns för att loppen då kommer i en annan ordning än i
 * P1, och för att planen sträcker sig över både ett årsskifte och ett skottår.
 */
export const P6: PlanInput = {
  schemaVersion: 2,
  today: '2027-05-03',
  startDate: '2027-05-03',
  // Loppen står med flit i den ordning man brukar rabbla klassikern, inte i
  // datumordning: Vasaloppet först fast det går sist. Motorn ska följa datumen.
  races: [
    // Mars 2028 — nästa Vasaloppet efter en vårstart 2027.
    { id: 'vasaloppet', date: '2028-03-05' },
    { id: 'vatternrundan', date: LOPP.vatternrundan },
    { id: 'vansbrosimningen', date: LOPP.vansbrosimningen },
    { id: 'lidingoloppet', date: LOPP.lidingoloppet },
  ],
  levels: { ski: 'new', swim: 'experienced', bike: 'experienced', run: 'experienced' },
  hoursPerWeek: 8,
  // Arbetar helger: långpasset på onsdag och vilodagen på söndag. Profilen är
  // därmed den som prövar att de valda dagarna faktiskt används.
  preferredDays: { longSession: 3, rest: 7 },
  equipment: { ...INGEN_UTRUSTNING, pool: true, bike: true },
};

export const PROFILES = { P1, P2, P3, P4, P5, P6 } as const;
export type ProfileName = keyof typeof PROFILES;
