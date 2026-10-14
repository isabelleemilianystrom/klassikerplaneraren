/**
 * Programgenerering. Rena funktioner: indata in, program ut.
 *
 * Inga sidoeffekter här — ingen localStorage, ingen DOM, inget nätverk och
 * inget `new Date()`. Dagens datum skickas in som argument (`today`) så att
 * genereringen är deterministisk och testbar.
 *
 * Genereringen går i fyra steg:
 *  1. `timeline` — vilka veckor programmet omfattar
 *  2. `phases`   — vilken roll varje vecka har
 *  3. `sessions` — vilka pass veckan innehåller
 *  4. `season`   — skidpass byter form utanför snöperioden (inuti steg 3)
 */
import type { ClassicVariant, IsoDate, PlanInput, Program, ProgramWarning, Week } from '../types';
import { startOfWeek } from './dates';
import { buildBlocks } from './blocks';
import { assignPhases } from './phases';
import { lacksSkiSubstitute } from './season';
import { buildSessions } from './sessions';
import { buildTimeline } from './timeline';

export { buildBlocks, groupRacesIntoBlocks } from './blocks';
export { assignPhases, type PhasedWeek } from './phases';
export { availableDays, preferredLongDay, trainingDaysOfWeek } from './schedule';
export { isSnowMonth, isSnowWeek, skiSubstitute } from './season';
export { activeDisciplines, buildSessions, weeklyHours } from './sessions';
export {
  buildTimeline,
  lastRaceDate,
  requireClassicWindow,
  requireFutureRaces,
  weekIndexOf,
} from './timeline';

/**
 * Timmar i veckan som behövs för ett program med både långpass, kvalitetspass
 * och underhåll. Under det blir programmet tunt, och användaren ska få veta det
 * i stället för att undra varför.
 *
 * Tröskeln följer varianten: 315 km på cykel kräver mer tid i sadeln än 100 km.
 */
export const COMFORTABLE_HOURS_PER_WEEK: Record<ClassicVariant, number> = {
  full: 7,
  half: 5,
  short: 4,
  women: 4,
};

/** Genererar ett komplett träningsprogram. */
export function generateProgram(input: PlanInput, today: IsoDate): Program {
  const timeline = buildTimeline(input.races, today);
  const phased = assignPhases(timeline, input.races);
  const { blocks, blockOfWeek } = buildBlocks(timeline, input.races);

  const weeks: Week[] = phased.map((week, index) => {
    const sessions = buildSessions(week, input);
    // Loppet självt hör till veckan, inte till passen: det är inte träning.
    const raceThisWeek = input.races[week.targetRace];
    const racing = startOfWeek(raceThisWeek) === week.startDate;
    return {
      startDate: week.startDate,
      phase: week.phase,
      targetRace: week.targetRace,
      followsRace: week.followsRace,
      block: blockOfWeek[index] ?? 0,
      ...(racing ? { raceDate: raceThisWeek } : {}),
      totalHours: sessions.reduce((sum, session) => sum + session.hours, 0),
      sessions,
    };
  });

  return {
    version: 1,
    createdAt: today,
    input,
    blocks,
    weeks,
    warnings: collectWarnings(input, weeks),
  };
}

function collectWarnings(input: PlanInput, weeks: readonly Week[]): ProgramWarning[] {
  const warnings: ProgramWarning[] = [];

  if (input.hoursPerWeek < COMFORTABLE_HOURS_PER_WEEK[input.variant]) {
    warnings.push('tightBudget');
  }

  const hasSubstitutedSkiing = weeks.some((week) =>
    week.sessions.some((session) => session.substitute === 'polesAndStrength'),
  );
  if (hasSubstitutedSkiing && lacksSkiSubstitute(input.equipment)) {
    warnings.push('noSkiSubstitute');
  }

  return warnings;
}
