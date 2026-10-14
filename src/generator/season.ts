/**
 * Säsongsanpassning: när går skidpass att göra på snö, och vad blir de annars?
 *
 * Rena funktioner. Skidpass tas aldrig bort — de byter form. Vilken form beror
 * på vad användaren kommer åt.
 */
import type { Equipment, IsoDate, SnowSeason, Substitute } from '../types';

/** Månaden ett datum ligger i, 1–12. */
export function monthOf(date: IsoDate): number {
  return Number(date.slice(5, 7));
}

/**
 * Sant när månaden ligger i snöperioden.
 *
 * Perioden får gå över nyår: december–mars betyder 12, 1, 2 och 3. Då är
 * `startMonth` större än `endMonth`, och villkoret blir ett eller-villkor
 * i stället för ett och-villkor.
 */
export function isSnowMonth(month: number, season: SnowSeason): boolean {
  const { startMonth, endMonth } = season;
  if (startMonth <= endMonth) {
    return month >= startMonth && month <= endMonth;
  }
  return month >= startMonth || month <= endMonth;
}

/** Sant när veckan ligger i snöperioden. */
export function isSnowWeek(weekStart: IsoDate, season: SnowSeason): boolean {
  return isSnowMonth(monthOf(weekStart), season);
}

/**
 * Formen ett skidpass tar utanför snöperioden.
 *
 * Långa pass: rullskidor först, de ger samma rörelse i samma tempo under lång
 * tid. Hårda pass: stakmaskin först, den går att styra exakt och kräver ingen
 * väg. Finns ingetdera blir det stavgång och överkroppsstyrka — sämre, men
 * grenen försvinner inte ur programmet.
 */
export function skiSubstitute(equipment: Equipment, longSession: boolean): Substitute {
  const order: Substitute[] = longSession
    ? ['rollerSkis', 'skiErgometer']
    : ['skiErgometer', 'rollerSkis'];

  for (const option of order) {
    if (option === 'rollerSkis' && equipment.rollerSkis) return option;
    if (option === 'skiErgometer' && equipment.skiErgometer) return option;
  }
  return 'polesAndStrength';
}

/** Sant när användaren saknar både stakmaskin och rullskidor. */
export function lacksSkiSubstitute(equipment: Equipment): boolean {
  return !equipment.skiErgometer && !equipment.rollerSkis;
}

/**
 * Sant när veckan ligger i den angivna säsongen.
 *
 * Samma logik som snöperioden, men används också för öppet vatten — båda är
 * månadsintervall som får gå över nyår.
 */
export function isSeasonWeek(weekStart: IsoDate, season: SnowSeason): boolean {
  return isSnowMonth(monthOf(weekStart), season);
}
