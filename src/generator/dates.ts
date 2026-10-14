/**
 * Datumaritmetik på ISO-strängar (`YYYY-MM-DD`).
 *
 * Rena funktioner utan sidoeffekter: ingen frågar vad klockan är. `Date` används
 * internt för att räkna, men lämnar aldrig modulen — in och ut går strängar, så
 * att programobjektet förblir serialiserbart.
 *
 * Allt räknas i UTC. Datum utan tid har ingen tidszon, och räknar vi i lokal tid
 * hoppar dygnen fel vid sommartidsskiften.
 */
import type { IsoDate } from '../types';

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

function parse(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Datumet som ISO-sträng. */
export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/**
 * Sant för ett datum som både har rätt form och faktiskt finns.
 * `2027-02-30` har rätt form men finns inte, och fångas av att vi räknar
 * tillbaka till sträng och jämför.
 */
export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_PATTERN.test(value)) return false;
  const parsed = parse(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return toIso(parsed) === value;
}

/** Samma datum, eller ett tydligt fel. `name` beskriver fältet för användaren. */
export function requireIsoDate(value: string, name: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new Error(`${name} är inte ett giltigt datum på formen YYYY-MM-DD: "${value}"`);
  }
  return value;
}

/** Datumet `days` dagar senare. Negativt tal går bakåt. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = parse(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toIso(shifted);
}

/** Datumet `weeks` veckor senare. */
export function addWeeks(date: IsoDate, weeks: number): IsoDate {
  return addDays(date, weeks * DAYS_PER_WEEK);
}

/** Antal dygn från `from` till `to`. Negativt när `to` ligger före `from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / MS_PER_DAY);
}

/** Måndagen i samma vecka. Veckan börjar på måndag, som i Sverige. */
export function startOfWeek(date: IsoDate): IsoDate {
  const weekday = (parse(date).getUTCDay() + 6) % DAYS_PER_WEEK;
  return addDays(date, -weekday);
}

/** Sant när datumet är en måndag. */
export function isMonday(date: IsoDate): boolean {
  return startOfWeek(date) === date;
}

/** Det tidigaste av datumen. */
export function earliest(dates: readonly IsoDate[]): IsoDate {
  return pick(dates, (candidate, best) => candidate < best);
}

/** Det senaste av datumen. */
export function latest(dates: readonly IsoDate[]): IsoDate {
  return pick(dates, (candidate, best) => candidate > best);
}

/**
 * ISO-datum kan jämföras som strängar: formatet är fast bredd och går från
 * störst till minst enhet.
 */
function pick(dates: readonly IsoDate[], better: (a: IsoDate, b: IsoDate) => boolean): IsoDate {
  const [first, ...rest] = dates;
  if (first === undefined) throw new Error('Listan med datum är tom.');
  return rest.reduce((best, candidate) => (better(candidate, best) ? candidate : best), first);
}

/** Veckodag enligt ISO: 1 = måndag, 7 = söndag. */
export function weekdayOf(date: IsoDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = parse(date).getUTCDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
