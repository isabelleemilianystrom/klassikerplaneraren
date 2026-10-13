/**
 * Fasindelningen: vilken roll varje vecka har.
 *
 * Steg 2 av genereringen. Här bestäms *vad* en vecka ska göra, inte *vilka pass*
 * den innehåller. Rena funktioner, inga sidoeffekter.
 *
 * Modellen vilar på fyra principer som är gemensamma för uthållighetsträning:
 *
 *  1. Träningen går i trappsteg: uppbyggnad -> bygge -> toppning. Att köra
 *     likadant vecka efter vecka ger ingen utveckling.
 *  2. Nedtrappning före lopp sänker volymen men behåller intensiteten, så att
 *     man är utvilad utan att tappa skärpa.
 *  3. Kroppen blir starkare under återhämtningen, inte under passet. Därför
 *     följer en lugnare vecka efter varje lopp.
 *  4. Belastningen behöver pausas regelbundet. Var fjärde vecka dras volymen
 *     ner även mitt i en uppbyggnad.
 */
import { DISCIPLINES, type Discipline, type IsoDate, type Phase, type RaceDates } from '../types';
import { startOfWeek } from './dates';

/** Veckor med toppningsfokus närmast före loppveckan. */
export const PEAK_WEEKS = 3;

/** Veckor med byggfokus före toppningen. Längre bort än så är uppbyggnad. */
export const BUILD_WEEKS = 8;

/** Så ofta en lugnare vecka läggs in i en lång uppbyggnad. */
export const DELOAD_EVERY = 4;

/** En vecka med sin roll och sitt mål, innan passen fylls i. */
export interface PhasedWeek {
  startDate: IsoDate;
  phase: Phase;
  /** Loppet veckan är periodiserad mot. */
  targetRace: Discipline;
  /**
   * Veckan kommer direkt efter ett lopp och ska vara lättare än fasen annars
   * kräver.
   *
   * Ligger två lopp så tätt att veckan efter det ena är det andras loppvecka
   * blir fasen `taper` — man ska prestera i helgen — men kroppen har just
   * tävlat. Flaggan bär den informationen vidare till passplaneringen, så att
   * återhämtningen inte tappas bort bara för att fasen heter något annat.
   */
  followsRace: boolean;
}

/** Loppen sorterade i datumordning. */
function racesInOrder(races: RaceDates): { discipline: Discipline; date: IsoDate }[] {
  return DISCIPLINES.map((discipline) => ({ discipline, date: races[discipline] })).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * Ger varje vecka i tidslinjen en fas och ett lopp att sikta mot.
 *
 * Ordningen är viktig: loppveckan och veckan efter ett lopp bestäms först och
 * kan inte skrivas över. Nedtrappning och återhämtning är obligatoriska också
 * när två lopp ligger tätt — det är då de behövs som mest.
 */
export function assignPhases(
  timeline: readonly IsoDate[],
  races: RaceDates,
): PhasedWeek[] {
  const ordered = racesInOrder(races);
  const raceWeeks = new Map<IsoDate, Discipline>();
  for (const { discipline, date } of ordered) {
    const week = startOfWeek(date);
    // Två lopp samma vecka: det första loppet äger veckan.
    if (!raceWeeks.has(week)) raceWeeks.set(week, discipline);
  }

  let sinceDeload = 0;

  return timeline.map((startDate, index) => {
    const target = targetRaceFor(ordered, startDate);
    const previous = timeline[index - 1];
    const followsRace = previous !== undefined && raceWeeks.has(previous);
    const racingThisWeek = raceWeeks.get(startDate);

    // Loppveckan vinner alltid. Ligger den direkt efter ett annat lopp bär
    // followsRace informationen om att veckan också är återhämtning.
    if (racingThisWeek !== undefined) {
      sinceDeload = 0;
      return { startDate, phase: 'taper', targetRace: racingThisWeek, followsRace };
    }

    if (followsRace) {
      sinceDeload = 0;
      return { startDate, phase: 'recovery', targetRace: target, followsRace };
    }

    const weeksLeft = weeksUntilRace(timeline, startDate, ordered);
    sinceDeload += 1;

    // Toppningen får inte brytas av en nedtrappningsvecka — den är redan lugnare
    // i volym, och veckorna närmast loppet ska vara skarpa.
    if (weeksLeft <= PEAK_WEEKS) {
      return { startDate, phase: 'peak', targetRace: target, followsRace };
    }

    if (sinceDeload >= DELOAD_EVERY) {
      sinceDeload = 0;
      return { startDate, phase: 'recovery', targetRace: target, followsRace };
    }

    return {
      startDate,
      phase: weeksLeft <= BUILD_WEEKS ? 'build' : 'base',
      targetRace: target,
      followsRace,
    };
  });
}

/** Loppet veckan siktar mot: nästa lopp som inte redan passerat veckan. */
function targetRaceFor(
  ordered: readonly { discipline: Discipline; date: IsoDate }[],
  weekStart: IsoDate,
): Discipline {
  const next = ordered.find(({ date }) => startOfWeek(date) >= weekStart);
  // Efter sista loppet siktar återhämtningsveckan tillbaka mot det loppet.
  return next?.discipline ?? (ordered.at(-1) as { discipline: Discipline }).discipline;
}

/** Antal veckor kvar till nästa lopp. 0 betyder att loppet går den här veckan. */
function weeksUntilRace(
  timeline: readonly IsoDate[],
  weekStart: IsoDate,
  ordered: readonly { discipline: Discipline; date: IsoDate }[],
): number {
  const nextRace = ordered.find(({ date }) => startOfWeek(date) >= weekStart);
  if (nextRace === undefined) return Number.POSITIVE_INFINITY;
  return timeline.indexOf(startOfWeek(nextRace.date)) - timeline.indexOf(weekStart);
}
