/**
 * Passplaneringen: vad en vecka faktiskt innehåller.
 *
 * Rena funktioner.
 *
 * Veckan byggs i fyra lager:
 *  1. Nästa lopps gren får långpasset och kvalitetspasset. De är veckans
 *     nyckelpass och markeras som sådana.
 *  2. Grenar där användaren är nybörjare hålls igång med ett pass i veckan,
 *     hela året. Teknikgrenar går inte att komma ikapp på slutet.
 *  3. Styrka läggs till när timmarna räcker — den förebygger skador och är
 *     stödjande, inte bärande.
 *  4. Passen läggs ut på de dagar användaren kan träna.
 *
 * Passen märks med kondition eller styrka, inte med vilket lopp de tränar mot.
 * Fokuset hör hemma på blocket. Den som blir sjuk och missar ett pass ska inte
 * känna att hon missat Vasaloppet.
 */
import type {
  Discipline,
  Goal,
  IsoDate,
  Level,
  PlanInput,
  Phase,
  Session,
  SessionPriority,
  SessionPurpose,
  Weekday,
} from '../types';
import { DISCIPLINES } from '../types';
import type { PhasedWeek } from './phases';
import { trainingDaysOfWeek, preferredLongDay } from './schedule';
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

/**
 * Hur stor del av nästa lopps tid som läggs på kvalitet.
 *
 * Den som vill ta sig runt behöver framför allt volym och vana. Den som har ett
 * tidsmål behöver mer tid i hög intensitet. Andelen hålls inom 20–35 % — mer än
 * så sliter mer än det ger.
 */
const QUALITY_SHARE: Record<Goal, number> = {
  finish: 0.2,
  improve: 0.3,
  time: 0.35,
};

/** Kortaste pass vi skriver ut. */
const MIN_SESSION_HOURS = 0.5;

/** Styrkepassets längd. */
const STRENGTH_HOURS = 0.75;

function roundDown(hours: number): number {
  return Math.floor(hours * 2) / 2;
}

/** Veckans totala timmar, aldrig över budgeten. */
export function weeklyHours(week: PhasedWeek, hoursPerWeek: number): number {
  const load = PHASE_LOAD[week.phase] * (week.followsRace ? AFTER_RACE_LOAD : 1);
  return roundDown(Math.min(hoursPerWeek, hoursPerWeek * load));
}

/**
 * Grenarna veckan ska innehålla: nästa lopps gren, plus grenar där användaren
 * är nybörjare. Grenar hon behärskar vilar tills de blir nästa lopp.
 */
export function activeDisciplines(
  targetRace: Discipline,
  levels: Record<Discipline, Level>,
): Discipline[] {
  return DISCIPLINES.filter(
    (discipline) => discipline === targetRace || levels[discipline] === 'beginner',
  );
}

/** Ett pass innan det fått dag och säsongsform. */
interface PlannedSession {
  discipline: Discipline;
  hours: number;
  purpose: SessionPurpose;
  priority: SessionPriority;
  long: boolean;
}

/** Passen i en vecka, med dag och eventuell ersättningsform. */
export function buildSessions(week: PhasedWeek, input: PlanInput): Session[] {
  const budget = weeklyHours(week, input.hoursPerWeek);
  if (budget < MIN_SESSION_HOURS) return [];

  const active = activeDisciplines(week.targetRace, input.levels);
  const others = active.filter((discipline) => discipline !== week.targetRace);

  const maintenance: PlannedSession[] = others.map((discipline) => ({
    discipline,
    hours: roundDown(Math.min(budget / (others.length + 2), 1.5)),
    purpose: maintenancePurpose(discipline, input.levels[discipline]),
    priority: 'supporting',
    long: false,
  }));

  const maintenanceHours = maintenance.reduce((sum, session) => sum + session.hours, 0);
  const planned = [
    ...targetSessions(week, budget - maintenanceHours, input.goals[week.targetRace]),
    ...maintenance,
  ].filter((session) => session.hours >= MIN_SESSION_HOURS);

  const used = planned.reduce((sum, session) => sum + session.hours, 0);
  if (budget - used >= STRENGTH_HOURS) {
    planned.push({
      discipline: week.targetRace,
      hours: STRENGTH_HOURS,
      purpose: 'strength',
      priority: 'supporting',
      long: false,
    });
  }

  return assignDays(planned, input).map((session) => withSeason(session, week.startDate, input));
}

/**
 * Nästa lopps pass: ett långpass och ett kvalitetspass, båda nyckelpass.
 *
 * Målet styr hur mycket av tiden som går till kvalitet. Under nedtrappning och
 * återhämtning sjunker volymen, men kvalitetspasset finns kvar — det är så man
 * blir utvilad utan att tappa skärpa.
 */
function targetSessions(week: PhasedWeek, hours: number, goal: Goal): PlannedSession[] {
  if (hours < MIN_SESSION_HOURS) return [];

  const quality = roundDown(hours * QUALITY_SHARE[goal]);
  const long = roundDown(hours - quality);

  const sessions: PlannedSession[] = [
    {
      discipline: week.targetRace,
      hours: long,
      purpose: longPurpose(week.phase),
      priority: 'key',
      long: true,
    },
    {
      discipline: week.targetRace,
      hours: quality,
      purpose: qualityPurpose(week.phase),
      priority: 'key',
      long: false,
    },
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

/**
 * Lägger passen på veckodagar.
 *
 * Långpasset får användarens önskade dag. Resten fördelas på de övriga valda
 * dagarna i tur och ordning, vilket ger störst avstånd mellan dem.
 */
function assignDays(
  planned: readonly PlannedSession[],
  input: PlanInput,
): (PlannedSession & { day: Weekday })[] {
  const days = trainingDaysOfWeek(input.trainingDays, planned.length);
  if (days.length === 0) return [];

  const longDay = preferredLongDay(input.trainingDays);
  const rest = days.filter((day) => day !== longDay);

  // Fler pass än dagar: de sista passen faller bort hellre än att två hamnar
  // på samma dag. Nyckelpassen ligger först i listan och överlever.
  let next = 0;
  return planned.slice(0, days.length).map((session) => {
    if (session.long) return { ...session, day: longDay };
    const day = rest[next] ?? longDay;
    next += 1;
    return { ...session, day };
  });
}

/** Byter skidpass mot ersättningsform utanför snöperioden. */
function withSeason(
  session: PlannedSession & { day: Weekday },
  weekStart: IsoDate,
  input: PlanInput,
): Session {
  const base: Session = {
    discipline: session.discipline,
    kind: session.purpose === 'strength' ? 'strength' : 'endurance',
    priority: session.priority,
    day: session.day,
    hours: session.hours,
    purpose: session.purpose,
  };

  if (session.discipline !== 'skiing' || isSnowWeek(weekStart, input.snowSeason)) {
    return base;
  }
  return { ...base, substitute: skiSubstitute(input.equipment, session.long) };
}
