/**
 * Tidslinjen: vilka veckor programmet spänner över.
 *
 * Steg 1 av genereringen. Här finns inga pass och ingen periodisering — bara
 * svaret på frågan "vilka veckor ska planeras?". Rena funktioner, dagens datum
 * skickas in.
 */
import { DISCIPLINES, type IsoDate, type RaceDates } from '../types';
import { addWeeks, daysBetween, latest, requireIsoDate, startOfWeek } from './dates';

/** Loppdatumen validerade och i en lista. */
export function raceDates(races: RaceDates): IsoDate[] {
  return DISCIPLINES.map((discipline) =>
    requireIsoDate(races[discipline], `Loppdatumet för ${discipline}`),
  );
}

/** Datumet för det sista loppet. */
export function lastRaceDate(races: RaceDates): IsoDate {
  return latest(raceDates(races));
}

/**
 * Veckor som läggs till efter det sista loppet, för återhämtning.
 *
 * Återhämtning efter lopp är en obligatorisk fas. Slutade programmet på
 * loppveckan skulle sista loppet bli det enda utan den.
 */
export const RECOVERY_WEEKS_AFTER_LAST_RACE = 1;

/**
 * Veckorna programmet omfattar, som måndagsdatum i ordning.
 *
 * Första veckan är den som innehåller `today` — man börjar träna i dag, inte
 * nästa måndag. Sedan följer veckorna fram till och med det sista loppets
 * vecka, plus en återhämtningsvecka efter det.
 */
export function buildTimeline(races: RaceDates, today: IsoDate): IsoDate[] {
  const start = startOfWeek(requireIsoDate(today, 'Dagens datum'));
  requireFutureRaces(races, today);

  const end = addWeeks(startOfWeek(lastRaceDate(races)), RECOVERY_WEEKS_AFTER_LAST_RACE);
  const weeks: IsoDate[] = [];
  for (let monday = start; monday <= end; monday = addWeeks(monday, 1)) {
    weeks.push(monday);
  }
  return weeks;
}

/**
 * Kastar om något loppdatum redan har varit.
 *
 * Det går inte att träna mot ett lopp som är över, och ett passerat datum är
 * nästan alltid ett skrivfel — fel år är det vanligaste. Loppet samma dag som
 * i dag räknas som framåt: det har inte sprungits än.
 */
export function requireFutureRaces(races: RaceDates, today: IsoDate): void {
  const passed = raceDates(races).filter((date) => daysBetween(today, date) < 0);
  if (passed.length > 0) {
    throw new Error(
      `Loppdatum som redan har varit går inte att planera mot: ${passed.sort().join(', ')}. ` +
        'Kontrollera att du angett rätt årtal.',
    );
  }
}

/** Veckan ett lopp ligger i, som index i tidslinjen. */
export function weekIndexOf(timeline: readonly IsoDate[], date: IsoDate): number {
  return timeline.indexOf(startOfWeek(date));
}
