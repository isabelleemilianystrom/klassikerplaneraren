/**
 * Passplaneringen: vad en vecka faktiskt innehåller.
 *
 * Steg 3 av genereringen. Rena funktioner.
 *
 * Veckan byggs i tre lager:
 *  1. Nästa lopps gren får kvalitetspasset och långpasset — det är den som ska
 *     toppas.
 *  2. Grenar där användaren är nybörjare hålls igång med ett pass i veckan,
 *     hela året. Teknikgrenar går inte att komma ikapp på slutet.
 *  3. Styrka läggs till när timmarna räcker.
 *
 * Volymen skalas av fasen och får aldrig överstiga användarens timbudget.
 */
import type {
  Discipline,
  IsoDate,
  Level,
  PlanInput,
  Phase,
  Session,
  SessionPurpose,
} from '../types';
import { DISCIPLINES } from '../types';
import type { PhasedWeek } from './phases';
import { isSnowWeek, skiSubstitute } from './season';

/** Hur stor del av timbudgeten en fas använder. */
const PHASE_LOAD: Record<Phase, number> = {
  base: 0.8,
  build: 1,
  peak: 0.9,
  taper: 0.5,
  recovery: 0.6,
};

/** Veckan efter ett lopp är lättare än fasen annars kräver. */
const AFTER_RACE_LOAD = 0.7;

/** Kortaste pass vi skriver ut. Under det är passet inte värt att planera. */
const MIN_SESSION_HOURS = 0.5;

/** Styrka läggs till först när så här många timmar finns kvar. */
const STRENGTH_HOURS = 0.75;

/** Timmar avrundas till halvtimmar — ingen planerar ett pass på 37 minuter. */
function roundDown(hours: number): number {
  return Math.floor(hours * 2) / 2;
}

/** Veckans totala timmar, aldrig över budgeten. */
export function weeklyHours(week: PhasedWeek, hoursPerWeek: number): number {
  const load = PHASE_LOAD[week.phase] * (week.followsRace ? AFTER_RACE_LOAD : 1);
  return roundDown(Math.min(hoursPerWeek, hoursPerWeek * load));
}

/**
 * Grenarna veckan ska innehålla.
 *
 * Nästa lopps gren alltid, plus grenar där användaren är nybörjare. Grenar hon
 * redan behärskar vilar tills de blir nästa lopp — det är användarens val, och
 * det ger mer tid åt det som är närmast.
 */
export function activeDisciplines(
  targetRace: Discipline,
  levels: Record<Discipline, Level>,
): Discipline[] {
  return DISCIPLINES.filter(
    (discipline) => discipline === targetRace || levels[discipline] === 'beginner',
  );
}

/** Passen i en vecka. */
export function buildSessions(week: PhasedWeek, input: PlanInput): Session[] {
  const budget = weeklyHours(week, input.hoursPerWeek);
  if (budget < MIN_SESSION_HOURS) return [];

  const active = activeDisciplines(week.targetRace, input.levels);
  const others = active.filter((discipline) => discipline !== week.targetRace);

  // Underhållspassen tar sin del först, så att en nybörjargren aldrig trängs ut
  // av toppningen mot ett annat lopp.
  const maintenance = others.map((discipline) => ({
    discipline,
    hours: roundDown(Math.min(budget / (others.length + 2), 1.5)),
    purpose: maintenancePurpose(discipline, input.levels[discipline]),
  }));

  const maintenanceHours = maintenance.reduce((sum, session) => sum + session.hours, 0);
  const forTarget = budget - maintenanceHours;

  const target = targetSessions(week, forTarget);
  const planned = [...target, ...maintenance].filter(
    (session) => session.hours >= MIN_SESSION_HOURS,
  );

  const used = planned.reduce((sum, session) => sum + session.hours, 0);
  if (budget - used >= STRENGTH_HOURS) {
    planned.push({
      discipline: week.targetRace,
      hours: STRENGTH_HOURS,
      purpose: 'strength',
    });
  }

  return planned.map((session) => withSeason(session, week.startDate, input));
}

/**
 * Nästa lopps pass: ett långpass och ett kvalitetspass.
 *
 * Fördelningen håller ungefär 70–80 % lugnt och 20–30 % hårt. Under
 * nedtrappning och återhämtning sjunker volymen men kvalitetspasset finns kvar
 * — det är så man är utvilad utan att tappa skärpa.
 */
function targetSessions(
  week: PhasedWeek,
  hours: number,
): { discipline: Discipline; hours: number; purpose: SessionPurpose }[] {
  if (hours < MIN_SESSION_HOURS) return [];

  const quality = roundDown(hours * 0.3);
  const long = roundDown(hours - quality);

  const sessions = [
    { discipline: week.targetRace, hours: long, purpose: longPurpose(week.phase) },
    { discipline: week.targetRace, hours: quality, purpose: qualityPurpose(week.phase) },
  ];
  return sessions.filter((session) => session.hours >= MIN_SESSION_HOURS);
}

function longPurpose(phase: Phase): SessionPurpose {
  return phase === 'taper' || phase === 'recovery' ? 'easy' : 'longSession';
}

function qualityPurpose(phase: Phase): SessionPurpose {
  switch (phase) {
    case 'base':
      return 'endurance';
    case 'recovery':
      return 'easy';
    default:
      return 'intervals';
  }
}

/** Nybörjare behöver teknik före volym. Simning framför allt. */
function maintenancePurpose(discipline: Discipline, level: Level): SessionPurpose {
  if (level === 'beginner') {
    return discipline === 'swimming' ? 'technique' : 'easy';
  }
  return 'endurance';
}

/** Byter skidpass mot ersättningsform utanför snöperioden. */
function withSeason(
  session: { discipline: Discipline; hours: number; purpose: SessionPurpose },
  weekStart: IsoDate,
  input: PlanInput,
): Session {
  if (session.discipline !== 'skiing' || isSnowWeek(weekStart, input.snowSeason)) {
    return session;
  }
  return {
    ...session,
    substitute: skiSubstitute(input.equipment, session.purpose === 'longSession'),
  };
}
