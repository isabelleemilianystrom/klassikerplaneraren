/**
 * Det reglerna behöver veta om en vecka, samlat.
 *
 * Varje ny regel sedan slutet av oktober la en parameter till funktionerna som
 * bygger veckan, och `longSession` hade till sist tio. En lista på tio säger
 * inte längre vad funktionen behöver, bara att den behöver nästan allt.
 *
 * De två grupperna här är de som faktiskt hänger samman:
 *
 * - **`WeekContext`** — vad veckan är: var i planen den ligger, hur mycket tid
 *   den har och hur många pass den rymmer.
 * - **`WeekDays`** — var ett pass kan hamna: veckans dagar, vad som redan är
 *   upptaget, och de dagar användaren valt.
 *
 * Rena databärare. Ingen logik, inga metoder.
 */
import type { WeekBudget } from './budget.ts';
import type { IsoDate, PlanInput, PreferredDays } from './types.ts';
import type { PlacedRace, WeekSkeleton } from './weeks.ts';

export interface WeekContext {
  /** Veckan som byggs. */
  week: WeekSkeleton;
  /** Alla veckor i planen — behövs för att se var i fasen veckan ligger. */
  allWeeks: readonly WeekSkeleton[];
  /** Veckans tid, fördelad per gren (R-05–R-10). */
  budget: WeekBudget;
  /** Användarens svar. */
  input: PlanInput;
  /** Loppen med sina veckor. */
  races: readonly PlacedRace[];
  /** Platser kvar att lägga pass på: en dag bär ett pass (R-42). */
  slots: number;
}

export interface WeekDays {
  /** Veckans datum, de som ligger på eller efter startdatumet (R-01). */
  all: readonly IsoDate[];
  /** Dagar som bär ett lopp (R-04). */
  raceDates: ReadonlySet<IsoDate>;
  /** Dagar som bär ett öppningspass (R-25). */
  openerDates: ReadonlySet<IsoDate>;
  /** Långpassdagen och vilodagen användaren valt (R-11, R-13). */
  preferred: PreferredDays;
}
