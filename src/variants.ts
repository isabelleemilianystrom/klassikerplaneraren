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
 * Vi modellerar därför distans, inte loppval. De godkända loppen:
 *
 *   full   skidor   Vasaloppet 90, Öppet Spår 90, Nattvasan 90, Engelbrektsloppet 60
 *          cykel    Vätternrundan 315
 *          simning  Vansbrosimningen 3, Vansbro Öppen Älv 3
 *          löpning  TCS Lidingöloppet 30
 *
 *   half   skidor   Vasaloppet 45, Nattvasan 45, Öppet Spår måndag 45, Engelbrektsloppet 45
 *          cykel    Halvvättern 150
 *          simning  Vansbro Halvsim 1,5
 *          löpning  TCS Lidingöloppet 15
 *
 *   short  skidor   Tjejvasan 30, Vasaloppet 30, Nattvasan 30, Öppet Spår måndag 30,
 *   women           Kristinaloppet 30, Engelbrektsloppet 30
 *          cykel    Tjejvättern 100, Vätternrundan 100
 *          simning  Vansbro Tjejsim 1, Vansbro Kortsim 1
 *          löpning  Rosa Bandet-loppet 10
 *
 * Två saker att veta om siffrorna:
 *
 * - **Vätternrundan är 315 km**, inte 300. Distansen ändrades 2020. Arrangörens
 *   marknadsföring säger fortfarande "300 km" på sina håll — gå på 315.
 * - **Engelbrektsloppet 60 km** godkänns i den hela klassikern istället för
 *   Vasaloppets 90 km. Standard är 90, eftersom tre av fyra godkända skidlopp är
 *   90 km, men användaren kan kryssa i att hon åker Engelbrektsloppet — se
 *   `raceDistanceKm` nedan.
 *
 * 'short' och 'women' har identiska distanser och samma skidlopp. Skillnaden är
 * vilka cykel- och simlopp som räknas, vilket inte påverkar träningen — båda
 * finns med för att användaren ska känna igen sin egen utmaning.
 */
export const VARIANT_DISTANCES_KM: Record<ClassicVariant, Record<Discipline, number>> = {
  full: { skiing: 90, cycling: 315, swimming: 3, running: 30 },
  half: { skiing: 45, cycling: 150, swimming: 1.5, running: 15 },
  short: { skiing: 30, cycling: 100, swimming: 1, running: 10 },
  women: { skiing: 30, cycling: 100, swimming: 1, running: 10 },
};

/**
 * Alla fyra loppen måste genomföras inom den här perioden för att räknas som
 * en klassiker. Man får börja med vilken gren som helst.
 */
export const CLASSIC_WINDOW_MONTHS = 12;

/** Engelbrektsloppets distans i den hela klassikern. */
export const ENGELBREKTSLOPPET_FULL_KM = 60;

/**
 * Distansen användaren ska träna mot i en gren.
 *
 * `engelbrektsloppet` ändrar bara något i den hela klassikern, där loppet är
 * 60 km istället för Vasaloppets 90 km. I övriga varianter har Engelbrektsloppet
 * samma distans som de andra godkända skidloppen, så valet saknar betydelse där.
 */
export function raceDistanceKm(
  variant: ClassicVariant,
  discipline: Discipline,
  engelbrektsloppet = false,
): number {
  if (discipline === 'skiing' && variant === 'full' && engelbrektsloppet) {
    return ENGELBREKTSLOPPET_FULL_KM;
  }
  return VARIANT_DISTANCES_KM[variant][discipline];
}

/** Sant när valet av Engelbrektsloppet påverkar distansen, alltså bara i `full`. */
export function engelbrektsloppetMatters(variant: ClassicVariant): boolean {
  return variant === 'full';
}
