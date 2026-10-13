/**
 * De fyra officiella varianterna av En Svensk Klassiker och vad de kräver.
 *
 * Ren domändata: inga sidoeffekter, ingen DOM, inga användartexter.
 * Källa: ensvenskklassiker.se, kontrollerat 2026-10-13.
 */
import type { ClassicVariant, Discipline } from './types';

export const VARIANTS: readonly ClassicVariant[] = ['full', 'half', 'short', 'women'];

/**
 * Distans per gren i kilometer.
 *
 * Varje gren har flera godkända lopp, men distansen är densamma inom varianten
 * och det är distansen som styr träningen — inte vilket lopp det heter.
 *
 * Undantag vi medvetet inte modellerar än: i den hela klassikern godkänns
 * Engelbrektsloppet 60 km som alternativ till Vasaloppets 90 km. Här räknar vi
 * på 90 km, alltså det tyngre av de två.
 *
 * 'short' och 'women' har identiska distanser. Skillnaden är vilka lopp som
 * räknas, vilket inte påverkar träningen — båda finns med för att användaren
 * ska känna igen sin egen utmaning.
 */
export const VARIANT_DISTANCES_KM: Record<ClassicVariant, Record<Discipline, number>> = {
  full: { skiing: 90, cycling: 300, swimming: 3, running: 30 },
  half: { skiing: 45, cycling: 150, swimming: 1.5, running: 15 },
  short: { skiing: 30, cycling: 100, swimming: 1, running: 10 },
  women: { skiing: 30, cycling: 100, swimming: 1, running: 10 },
};

/**
 * Alla fyra loppen måste genomföras inom den här perioden för att räknas som
 * en klassiker. Man får börja med vilken gren som helst.
 */
export const CLASSIC_WINDOW_MONTHS = 12;

/** Distansen användaren ska klara i en gren, givet sin variant. */
export function raceDistanceKm(variant: ClassicVariant, discipline: Discipline): number {
  return VARIANT_DISTANCES_KM[variant][discipline];
}
