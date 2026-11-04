/**
 * Säsong och utrustning (R-17, R-19, R-20, R-37).
 *
 * Fyra frågor som alla handlar om *när* och *med vad* ett pass går att göra:
 * finns det snö, är det öppet vatten, är grenen i säsong som alternativ, och
 * har användaren det som krävs.
 *
 * Rena funktioner av datum och indata. Ingen av dem rör planen.
 */
import { rules } from './config.ts';
import { monthOf } from './dates.ts';
import type { IsoDate, PlanInput, Session, TrainedSport } from './types.ts';

/**
 * Sant för ett datum i vintern (R-20).
 *
 * Bara månaden. Det är vintern som avgör om cykelpasset görs inomhus — en
 * trainer i januari handlar om mörker och väglag, inte om snötillgång.
 */
export function isWinter(date: IsoDate): boolean {
  return rules.season.winterMonths.includes(monthOf(date));
}

/**
 * Sant när det finns snö att åka skidor på (R-17).
 *
 * Två villkor: en vintermånad **och** tillgång till ett spår. Bara månaden
 * räcker inte — bor man i Skåne ligger det ingen snö i januari heller, och en
 * plan som lägger fyrtiotre timmar längdskidor där är en plan som inte går att
 * följa.
 */
export function hasSnow(date: IsoDate, input: PlanInput): boolean {
  if (!isWinter(date)) return false;

  const utrustning = input.equipment as Record<string, boolean>;
  return rules.substitutions.snowNeeds.every((flagga) => utrustning[flagga] === true);
}

/** Sant för ett pass som planeras i öppet vatten (R-19). */
export function isOpenWater(sport: Exclude<Session['sport'], null>, date: IsoDate): boolean {
  const grenar: readonly string[] = rules.substitutions.openWaterSports;
  if (!grenar.includes(sport)) return false;

  return rules.season.openWaterMonths.includes(monthOf(date));
}

/** Sant när grenen går att utöva den månaden (R-37). */
export function inSeason(sport: TrainedSport, month: number): boolean {
  const månader = rules.sessionAlternatives.seasonalMonths[sport];
  return månader === undefined || månader.includes(month);
}

/**
 * Sant när användaren har utrustning för grenen (R-37).
 *
 * Minst en av grenens flaggor räcker: skidor går med antingen snö eller
 * rullskidor, eller med en stakmaskin. Grenar som inte kräver något —
 * löpning — går alltid.
 */
export function hasEquipmentFor(sport: TrainedSport, input: PlanInput, date: IsoDate): boolean {
  const krav = rules.sessionAlternatives.requiresAnyEquipment[sport];
  if (krav === undefined) return true;

  // Finns snö krävs ingen utrustning för att åka skidor.
  const snögrenar: readonly string[] = rules.substitutions.snowSports;
  if (snögrenar.includes(sport) && hasSnow(date, input)) return true;

  const utrustning = input.equipment as Record<string, boolean>;
  return krav.some((flagga) => utrustning[flagga] === true);
}
