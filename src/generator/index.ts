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
import type { IsoDate, PlanInput, Program, ProgramWarning, Week } from '../types';
import { buildBlocks } from './blocks';
import { assignPhases } from './phases';
import { lacksSkiSubstitute } from './season';
import { buildSessions } from './sessions';
import { buildTimeline } from './timeline';
import { longSessionTarget, recommendedHours } from '../recommendations';
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
 * Minsta antal simpass i öppet vatten före simloppet.
 *
 * Två pass räcker för att möta våtdräkten, kylan och siktandet innan det gäller.
 */
export const MIN_OPEN_WATER_SESSIONS = 2;

/**
 * Så stor andel tomma veckor innan programmet kallas tomt.
 *
 * Enstaka tomma veckor är rimliga — nedtrappning och återhämtning kan landa
 * där. Är en tredjedel tomma räcker timmarna helt enkelt inte.
 */
export const MOSTLY_EMPTY_SHARE = 1 / 3;



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
    version: 2,
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
      longSessionTarget(
        estimatedRaceHours(input.variant, discipline, input.engelbrektsloppet),
        input.goals[discipline],
        MAX_SESSION_HOURS[discipline],
      ),
    );
    if (longest > 0 && longest < needed) {
      warnings.push('longSessionTooShort');
      break;
    }
  }

  // Riktmärket följer både varianten och målet. Den som vill ta sig runt en
  // kort klassiker ska inte få en varning för att hon inte tränar som en elitist.
  if (input.hoursPerWeek < recommendedHours(input.variant, input.goals).min) {
    warnings.push('tightBudget');
  }

  // Ett program där de flesta veckorna är tomma är inte ett program. Det ska
  // sägas rakt ut i stället för att användaren bläddrar genom femtio tomma kort.
  const empty = weeks.filter((week) => week.sessions.length === 0).length;
  if (weeks.length > 0 && empty > weeks.length * MOSTLY_EMPTY_SHARE) {
    warnings.push('mostlyEmpty');
  }

  // Första gången i våtdräkt och kallt vatten ska inte vara på tävlingsdagen.
  const openWaterSwims = weeks
    .filter((week) => week.startDate <= input.races.swimming)
    .flatMap((week) => week.sessions)
    .filter((session) => session.discipline === 'swimming' && session.openWater === true);
  if (openWaterSwims.length < MIN_OPEN_WATER_SESSIONS) {
    warnings.push('noOpenWaterBeforeSwim');
  }

  const hasSubstitutedSkiing = weeks.some((week) =>
    week.sessions.some((session) => session.substitute === 'polesAndStrength'),
  );
  if (hasSubstitutedSkiing && lacksSkiSubstitute(input.equipment)) {
    warnings.push('noSkiSubstitute');
  }

  return warnings;
}
