/**
 * Blocken: de sammanhängande perioderna programmet delas i.
 *
 * Ett block siktar mot ett lopp — eller mot två, när de ligger så nära att det
 * inte går att bygga form mot dem var för sig. Fokuset hör hemma på blocket,
 * inte på det enskilda passet. Missar man ett pass har man inte missat loppet.
 */
import { DISCIPLINES, type Block, type Discipline, type IsoDate, type RaceDates } from '../types';
import { daysBetween, startOfWeek } from './dates';

/**
 * Lopp som ligger närmare varandra än så här delar block.
 *
 * Under fem veckor hinner man inte bygga upp och toppa formen två gånger. Då
 * är det ärligare att säga att blocket siktar mot båda loppen.
 */
export const SHARED_BLOCK_WEEKS = 5;

/** Loppen i datumordning. */
function racesInOrder(races: RaceDates): { discipline: Discipline; date: IsoDate }[] {
  return DISCIPLINES.map((discipline) => ({ discipline, date: races[discipline] })).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/** Grupperar loppen i de block programmet ska delas i. */
export function groupRacesIntoBlocks(races: RaceDates): Discipline[][] {
  const ordered = racesInOrder(races);
  const groups: { discipline: Discipline; date: IsoDate }[][] = [];

  for (const race of ordered) {
    const current = groups.at(-1);
    const previous = current?.at(-1);
    const closeToPrevious =
      previous !== undefined &&
      daysBetween(previous.date, race.date) <= SHARED_BLOCK_WEEKS * 7;

    if (current !== undefined && closeToPrevious) {
      current.push(race);
    } else {
      groups.push([race]);
    }
  }

  return groups.map((group) => group.map((race) => race.discipline));
}

/**
 * Blocken med sina veckor.
 *
 * Varje block slutar veckan efter sitt sista lopp — återhämtningen hör till det
 * lopp man just genomfört, inte till nästa block. Första blocket börjar när
 * programmet börjar.
 */
export function buildBlocks(
  timeline: readonly IsoDate[],
  races: RaceDates,
): { blocks: Block[]; blockOfWeek: number[] } {
  const groups = groupRacesIntoBlocks(races);
  const lastWeekOfBlock = groups.map((group) => {
    const lastRace = group.at(-1) as Discipline;
    return startOfWeek(races[lastRace]);
  });

  const blockOfWeek = timeline.map((week) => {
    const index = lastWeekOfBlock.findIndex((raceWeek) => week <= raceWeek);
    // Veckorna efter det sista loppet är återhämtning i det sista blocket.
    return index === -1 ? groups.length - 1 : index;
  });

  const blocks: Block[] = groups.map((focus, index) => {
    const weeks = timeline.filter((_, week) => blockOfWeek[week] === index);
    return {
      focus,
      startDate: weeks[0] ?? (timeline[0] as IsoDate),
      endDate: weeks.at(-1) ?? (timeline.at(-1) as IsoDate),
    };
  });

  return { blocks, blockOfWeek };
}
