/**
 * Veckodagarna: vilken dag varje pass hamnar på.
 *
 * Rena funktioner. Utgår från hur många dagar användaren kan träna, vilken dag
 * hon vill lägga långpasset på, och vilka dagar som är omöjliga.
 *
 * Två principer styr placeringen: långpasset får sin önskade dag, och det hårda
 * passet läggs så långt från långpasset som veckan tillåter. Hårda dagar ska
 * varvas med lugna.
 */
import { WEEKDAYS, type TrainingDays, type Weekday } from '../types';

/** Dagar användaren faktiskt kan träna, i veckoordning. */
export function availableDays(days: TrainingDays): Weekday[] {
  return WEEKDAYS.filter((day) => !days.unavailableDays.includes(day));
}

/**
 * Dagarna veckans pass läggs på, så jämnt spridda som möjligt.
 *
 * Långpassets dag kommer först i listan — den är vald av användaren och ska
 * inte trängas undan. Resten fylls på med störst möjliga avstånd mellan dagarna
 * så att hårt och lugnt varvas.
 */
export function trainingDaysOfWeek(days: TrainingDays, count: number): Weekday[] {
  const available = availableDays(days);
  if (available.length === 0) return [];

  const wanted = Math.min(count, days.daysPerWeek, available.length);
  if (wanted <= 0) return [];

  const long = preferredLongDay(days);
  const chosen: Weekday[] = [long];

  // Välj resterande dagar en i taget: alltid den som ligger längst från de
  // redan valda, så att passen sprids över veckan i stället för att klumpa ihop.
  while (chosen.length < wanted) {
    const rest = available.filter((day) => !chosen.includes(day));
    const next = rest.reduce((best, day) =>
      minDistance(day, chosen) > minDistance(best, chosen) ? day : best,
    );
    chosen.push(next);
  }

  return chosen;
}

/**
 * Långpassets dag: den önskade om den går, annars närmaste möjliga.
 *
 * Ligger två dagar lika nära — måndag och lördag är båda en dag från söndag —
 * väljs den som kommer före. Önskar man söndag menar man helgen, och lördag
 * ligger närmare den tanken än måndag.
 */
export function preferredLongDay(days: TrainingDays): Weekday {
  const available = availableDays(days);
  const wanted = days.longSessionDay;
  if (available.includes(wanted)) return wanted;

  return available.reduce((best, day) => {
    const closer = weekdayDistance(day, wanted) - weekdayDistance(best, wanted);
    if (closer !== 0) return closer < 0 ? day : best;
    return isBefore(day, wanted) ? day : best;
  });
}

/** Sant när dagen ligger före den önskade, räknat bakåt runt veckan. */
function isBefore(day: Weekday, wanted: Weekday): boolean {
  return (wanted - day + 7) % 7 < (day - wanted + 7) % 7;
}

/** Avstånd mellan två veckodagar, mätt runt veckan. */
export function weekdayDistance(a: Weekday, b: Weekday): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, 7 - direct);
}

function minDistance(day: Weekday, chosen: readonly Weekday[]): number {
  return Math.min(...chosen.map((other) => weekdayDistance(day, other)));
}
