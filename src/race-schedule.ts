/**
 * Kommande loppdatum, som förslag i formuläret.
 *
 * Datumen ligger i koden och hämtas inte live. Appen har ingen backend, och
 * webbläsaren får inte läsa arrangörernas sidor direkt (CORS). Listan måste
 * därför uppdateras för hand varje år — se `SCHEDULE_CHECKED` nedan.
 *
 * Bara datum som gått att belägga finns med. Ett gissat datum vore sämre än
 * inget: användaren skulle tro att det var kontrollerat. Saknas ett datum
 * lämnas fältet tomt och användaren fyller i själv.
 *
 * Källor, kontrollerade 2026-10-13:
 *  - vasaloppet.se ............ Vasaloppet 90 km sön 7 mars 2027,
 *                              Tjejvasan 30 km lör 27 feb 2027
 *  - vatternrundan.se ......... Vätternrundan 315 km, start fre kväll 18 juni
 *                              2027, i mål lör 19 juni
 *  - vansbrosimningen.se ...... Vansbrosimningen 3 km lör 10 juli 2027,
 *                              Halvsim 1,5 km och Kortsim 1 km sön 4 juli 2027
 *  - lidingoloppet.se ......... TCS Lidingöloppet 30 km lör 25 sep 2027
 *                              (lopphelgen 24–26 sep)
 */
import type { ClassicVariant, Discipline, IsoDate } from './types';

/** När listan senast stämdes av mot arrangörernas sidor. */
export const SCHEDULE_CHECKED: IsoDate = '2026-10-13';

/**
 * Loppdatum per variant. Saknad gren betyder att datumet inte gått att belägga.
 *
 * Vätternrundan startar fredag kväll och avslutas under lördagen. Vi föreslår
 * startdagen, eftersom det är den dagen man ska vara i form.
 */
export const SUGGESTED_RACE_DATES: Record<
  ClassicVariant,
  Partial<Record<Discipline, IsoDate>>
> = {
  full: {
    skiing: '2027-03-07',
    cycling: '2027-06-18',
    swimming: '2027-07-10',
    running: '2027-09-25',
  },
  half: {
    swimming: '2027-07-04',
  },
  short: {
    skiing: '2027-02-27',
    swimming: '2027-07-04',
  },
  women: {
    skiing: '2027-02-27',
    swimming: '2027-07-04',
  },
};

/** Föreslaget datum, eller undefined när vi inte har något belagt. */
export function suggestedRaceDate(
  variant: ClassicVariant,
  discipline: Discipline,
): IsoDate | undefined {
  return SUGGESTED_RACE_DATES[variant][discipline];
}

/**
 * Förslagen som fortfarande ligger framåt i tiden.
 *
 * Ett förslag som hunnit passera är inte längre ett förslag — det skulle fylla
 * formuläret med datum som generatorn sedan avvisar.
 */
export function upcomingSuggestions(
  variant: ClassicVariant,
  today: IsoDate,
): Partial<Record<Discipline, IsoDate>> {
  const upcoming: Partial<Record<Discipline, IsoDate>> = {};
  for (const [discipline, date] of Object.entries(SUGGESTED_RACE_DATES[variant])) {
    if (date >= today) {
      upcoming[discipline as Discipline] = date;
    }
  }
  return upcoming;
}
