/**
 * Rekommendationer om hur mycket träning som brukar behövas.
 *
 * Ren domändata, utan sidoeffekter. Används både av formuläret — för att visa
 * ett riktmärke innan programmet skapas — och av generatorn, för att avgöra om
 * den ska säga till om att timmarna är knappa.
 *
 * Siffrorna utgår från vanliga motionärer med jobb och familj, inte från
 * elitsatsning. Att ta sig runt En Svensk Klassiker kräver betydligt mindre än
 * vad som ofta påstås; det är tidsmålen som kostar timmar.
 */
import type { ClassicVariant, Discipline, Goal } from './types';
import { DISCIPLINES } from './types';

/** Timmar i veckan som brukar räcka för att ta sig runt, per variant. */
const BASE_HOURS: Record<ClassicVariant, number> = {
  full: 6,
  half: 4.5,
  short: 3.5,
  women: 3.5,
};

/**
 * Hur mycket mer tid ett mer ambitiöst mål kräver.
 *
 * Att komma i mål och att komma i mål på en viss tid är olika projekt. Den
 * skillnaden ska synas i vad vi rekommenderar, inte bara i hur passen ser ut.
 */
const GOAL_FACTOR: Record<Goal, number> = {
  finish: 1,
  improve: 1.25,
  time: 1.5,
};

/**
 * Hur stor del av loppets längd det längsta passet bör nå.
 *
 * Man behöver inte ha tränat hela sträckan. Den som vill ta sig runt klarar sig
 * på betydligt kortare långpass än den som jagar en tid — kroppen behöver veta
 * vad som väntar, inte ha gjort det i förväg.
 */
export const LONG_SHARE_BY_GOAL: Record<Goal, number> = {
  finish: 0.35,
  improve: 0.5,
  time: 0.6,
};

/**
 * Hur långt det längsta passet i en gren bör bli.
 *
 * Både generatorn och varningen använder den här funktionen. Räknade de olika
 * skulle appen kunna varna för något den själv aldrig kan uppnå — vilket den
 * gjorde innan.
 */
export function longSessionTarget(raceHours: number, goal: Goal, cap: number): number {
  return Math.floor(Math.min(cap, raceHours * LONG_SHARE_BY_GOAL[goal]) * 2) / 2;
}

/** Ett riktmärke för veckotimmar: där det börjar fungera, och där det blir bekvämt. */
export interface HoursRecommendation {
  /** Under det här blir marginalerna små. */
  min: number;
  /** Här får programmet plats utan att tränga ihop sig. */
  comfortable: number;
}

/** Det mest krävande av användarens mål — träningen måste räcka till alla fyra. */
export function mostDemandingGoal(goals: Record<Discipline, Goal>): Goal {
  const order: Goal[] = ['finish', 'improve', 'time'];
  return DISCIPLINES.reduce<Goal>(
    (hardest, discipline) =>
      order.indexOf(goals[discipline]) > order.indexOf(hardest) ? goals[discipline] : hardest,
    'finish',
  );
}

/** Rekommenderade veckotimmar för varianten och målen. */
export function recommendedHours(
  variant: ClassicVariant,
  goals: Record<Discipline, Goal>,
): HoursRecommendation {
  const min = roundHalf(BASE_HOURS[variant] * GOAL_FACTOR[mostDemandingGoal(goals)]);
  return { min, comfortable: roundHalf(min * 1.3) };
}

function roundHalf(hours: number): number {
  return Math.round(hours * 2) / 2;
}
