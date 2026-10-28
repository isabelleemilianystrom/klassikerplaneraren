/**
 * Varningar om planens förutsättningar.
 *
 * En varning betyder *"det här når inte ditt mål"*, aldrig *"du tränar för
 * lite"*. Appen är byggd för folk som arbetar, och en plan som tiger om sina
 * egna begränsningar är sämre än ingen plan.
 *
 * Motorn ändrar aldrig planen för att slippa en varning. Den säger vad som
 * gäller och låter användaren bestämma.
 *
 * Rena funktioner, inga sidoeffekter.
 */
import { raceById, rules } from './config.ts';
import { startOfWeek, weeksBetween } from './dates.ts';
import type { PlanInput, RaceId } from './types.ts';
import type { WeekPlan } from './sessions.ts';

/** Ett lopp som ligger för nära starten för en hel uppbyggnad (R-35). */
export interface MidProgrammeStart {
  raceId: RaceId;
  /** Hela veckor från planens start till loppveckan. */
  weeksUntilRace: number;
  /** Veckor loppets egen uppbyggnad behöver: nedtrappning plus specifik fas. */
  weeksNeeded: number;
  /** Sant när planen saknar grundperiod helt. */
  withoutBase: boolean;
}

/**
 * Lopp som planen hoppar in mitt i uppbyggnaden mot (R-35).
 *
 * Gränsen är tio veckor och ligger i konfigurationen. Den är inte godtycklig:
 * tio veckor är hela uppbyggnaden för Vasaloppet och Vätternrundan — två
 * veckors nedtrappning plus åtta veckors specifik fas. Startar man senare än så
 * finns det ingen grundperiod kvar att göra.
 *
 * Bara det första loppet kontrolleras. De senare loppen har hela planen framför
 * sig och bygger upp sig i tur och ordning; att varna för dem vore att varna
 * för något som inte är ett problem.
 */
export function midProgrammeStarts(
  input: PlanInput,
  weeks: readonly WeekPlan[],
): MidProgrammeStart[] {
  const { weeksThreshold } = rules.warnings.midProgramme;

  const första = [...input.races].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (första === undefined) return [];

  const weeksUntilRace = weeksBetween(startOfWeek(input.startDate), startOfWeek(första.date));
  if (weeksUntilRace >= weeksThreshold) return [];

  const config = raceById(första.id);

  return [
    {
      raceId: första.id,
      weeksUntilRace,
      weeksNeeded: config.taperWeeks + config.specificWeeks,
      withoutBase: !weeks.some((plan) => plan.week.phase === 'base'),
    },
  ];
}

/** Varningstexterna för de lopp planen hoppar in mitt i (R-35). */
export function midProgrammeWarnings(starts: readonly MidProgrammeStart[]): string[] {
  const { text, noBaseSuffix } = rules.warnings.midProgramme;

  return starts.map((start) => {
    const grund = text
      .replace('{weeks}', weeksInWords(start.weeksUntilRace))
      .replace('{race}', raceById(start.raceId).name);

    return start.withoutBase ? grund + noBaseSuffix : grund;
  });
}

/**
 * Antal veckor i ord, med rätt böjning.
 *
 * "Det är 1 veckor till Vasaloppet" är den sortens fel som får en app att
 * kännas slarvig, och noll veckor betyder att loppet är den här veckan.
 */
function weeksInWords(weeks: number): string {
  if (weeks <= 0) return 'mindre än en vecka';
  if (weeks === 1) return '1 vecka';
  return `${weeks} veckor`;
}
