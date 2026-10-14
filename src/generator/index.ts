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
import { buildBlocks } from './blocks';
import { assignPhases } from './phases';
import { lacksSkiSubstitute } from './season';
import { buildSessions } from './sessions';
import { buildTimeline } from './timeline';
import { estimatedRaceHours, recoveryWeeksAfter } from '../variants';
import { MAX_SESSION_HOURS } from './sessions';
import { DISCIPLINES, type Discipline } from '../types';

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
  // Långa lopp kräver två veckors återhämtning, korta klarar sig med en.
  const recoveryWeeks = recoveryWeeksByRace(input);
  const lastRace = lastRaceDiscipline(input);

  const timeline = buildTimeline(input.races, today, recoveryWeeks[lastRace]);
  const phased = assignPhases(timeline, input.races, recoveryWeeks);
  const { blocks, blockOfWeek } = buildBlocks(timeline, input.races);

  const weeks: Week[] = phased.map((week, index) => {
    const sessions = buildSessions(week, input);
    const racing = week.raceDate !== undefined;
    return {
      startDate: week.startDate,
      phase: week.phase,
      targetRace: week.targetRace,
      followsRace: week.followsRace,
      block: blockOfWeek[index] ?? 0,
      ...(racing ? { raceDate: week.raceDate as IsoDate } : {}),
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

/** Återhämtningsveckor varje lopp kräver, utifrån hur länge det tar. */
function recoveryWeeksByRace(input: PlanInput): Record<Discipline, number> {
  const weeks = {} as Record<Discipline, number>;
  for (const discipline of DISCIPLINES) {
    weeks[discipline] = recoveryWeeksAfter(input.variant, discipline, input.engelbrektsloppet);
  }
  return weeks;
}

/** Grenen vars lopp ligger sist. */
function lastRaceDiscipline(input: PlanInput): Discipline {
  return DISCIPLINES.reduce((latest, discipline) =>
    input.races[discipline] > input.races[latest] ? discipline : latest,
  );
}

function collectWarnings(input: PlanInput, weeks: readonly Week[]): ProgramWarning[] {
  const warnings: ProgramWarning[] = [];

  // Det längsta passet säger mer om beredskapen än veckosumman gör.
  for (const discipline of DISCIPLINES) {
    const longest = Math.max(
      0,
      ...weeks.flatMap((week) =>
        week.sessions.filter((session) => session.discipline === discipline).map((s) => s.hours),
      ),
    );
    const needed = Math.min(
      MAX_SESSION_HOURS[discipline],
      estimatedRaceHours(input.variant, discipline, input.engelbrektsloppet) * 0.6,
    );
    if (longest > 0 && longest < needed) {
      warnings.push('longSessionTooShort');
      break;
    }
  }

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
