/**
 * Datum som ISO-strängar, `YYYY-MM-DD` utan klockslag.
 *
 * `date-fns` räknar i lokal tid, vilket är rätt här: en vecka är sju kalender­-
 * dagar även den helg klockan ställs om. `addWeeks` lägger till kalenderveckor,
 * inte 7 × 24 timmar, så sommartidsskiftet den 28 mars 2027 hanteras korrekt.
 *
 * `Date` används internt för att räkna men lämnar aldrig modulen — in och ut går
 * strängar, så att planen förblir serialiserbar.
 */
import {
  addDays as addDaysFns,
  addWeeks as addWeeksFns,
  differenceInCalendarWeeks,
  format,
  getISODay,
  isValid,
  parseISO,
  startOfWeek as startOfWeekFns,
} from 'date-fns';
import type { IsoDate } from './types.ts';

/** Veckan börjar på måndag. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

function parse(date: IsoDate): Date {
  const parsed = parseISO(date);
  if (!isValid(parsed)) throw new Error(`Ogiltigt datum: "${date}"`);
  return parsed;
}

function toIso(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

/** Sant för ett datum som både har rätt form och faktiskt finns. */
export function isIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

/** Samma datum, eller ett tydligt fel. `name` beskriver fältet för användaren. */
export function requireIsoDate(value: string, name: string): IsoDate {
  if (!isIsoDate(value)) {
    throw new Error(`${name} är inte ett giltigt datum på formen YYYY-MM-DD: "${value}"`);
  }
  return value;
}

/** Måndagen i datumets vecka. */
export function startOfWeek(date: IsoDate): IsoDate {
  return toIso(startOfWeekFns(parse(date), WEEK_OPTIONS));
}

/** Söndagen i datumets vecka. */
export function endOfWeek(date: IsoDate): IsoDate {
  return addDays(startOfWeek(date), 6);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(addDaysFns(parse(date), days));
}

export function addWeeks(date: IsoDate, weeks: number): IsoDate {
  return toIso(addWeeksFns(parse(date), weeks));
}

/** Antal hela veckor från `from` till `to`, räknat på måndagar. */
export function weeksBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarWeeks(parse(to), parse(from), WEEK_OPTIONS);
}

/** Veckodag enligt ISO: 1 = måndag, 7 = söndag. */
export function weekdayOf(date: IsoDate): number {
  return getISODay(parse(date));
}

/** Månad 1–12. */
export function monthOf(date: IsoDate): number {
  return Number(date.slice(5, 7));
}

/** Det senaste av datumen. ISO-datum går att jämföra som strängar. */
export function latest(dates: readonly IsoDate[]): IsoDate {
  const [first, ...rest] = dates;
  if (first === undefined) throw new Error('Listan med datum är tom.');
  return rest.reduce((senast, datum) => (datum > senast ? datum : senast), first);
}

/** Det tidigaste av datumen. */
export function earliest(dates: readonly IsoDate[]): IsoDate {
  const [first, ...rest] = dates;
  if (first === undefined) throw new Error('Listan med datum är tom.');
  return rest.reduce((tidigast, datum) => (datum < tidigast ? datum : tidigast), first);
}
