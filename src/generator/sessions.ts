/**
 * Passplaneringen: vad en vecka faktiskt innehåller.
 *
 * Rena funktioner.
 *
 * Veckan byggs i fem lager:
 *  1. Loppet räknas av från veckans budget. Loppet *är* veckans stora pass.
 *  2. Styrkan reserveras före resten, annars blir den aldrig av.
 *  3. Nästa lopps gren får långpasset och kvalitetspasset — nyckelpassen.
 *  4. Nybörjargrenar hålls igång med ett pass i veckan, hela året.
 *  5. Passen läggs ut på de dagar användaren kan träna — aldrig på loppdagen.
 *
 * Passen märks med kondition eller styrka, inte med vilket lopp de tränar mot.
 * Fokuset hör hemma på blocket.
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
  TrainingDays,
  Weekday,
} from '../types';
import { DISCIPLINES } from '../types';
import { estimatedRaceHours } from '../variants';
import { weekdayOf } from './dates';
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
 * Den som vill ta sig runt behöver volym och vana. Den som har ett tidsmål
 * behöver mer tid i hög intensitet.
 */
const QUALITY_SHARE: Record<Goal, number> = {
  finish: 0.2,
  improve: 0.3,
  time: 0.35,
};

/**
 * Längsta vettiga enskilda pass per gren, i timmar.
 *
 * Utan tak delar budgeten ut orimliga pass: tre och en halv timmes simning
 * finns inte som motionspass, medan cykelpassen behöver få bli riktigt långa
 * för att förbereda 315 km. Taken speglar vad grenen tål, inte vad budgeten
 * råkar tillåta.
 */
export const MAX_SESSION_HOURS: Record<Discipline, number> = {
  swimming: 1.5,
  running: 2.5,
  skiing: 4,
  cycling: 8,
};

/**
 * Hur stor del av veckan ett enskilt långpass får ta.
 *
 * Långpasset är veckans tyngsta pass men får inte vara hela veckan — då blir
 * det varken återhämtning eller kvalitet kvar.
 */
const MAX_LONG_SHARE = 0.7;

/**
 * Hur många veckor före loppet långpasset når sin fulla längd.
 *
 * Längre bort än så byggs det upp gradvis. Det enda som förbereder kroppen på
 * elva timmar i sadeln är att successivt ha suttit fem, sex och sju.
 */
const LONG_RAMP_WEEKS = 14;

/** Långpassets kortaste andel av sitt tak, längst bort från loppet. */
const LONG_RAMP_FLOOR = 0.4;

/** Styrkepassets längd och hur många som ryms i en vecka. */
const STRENGTH_HOURS = 0.75;
const MAX_STRENGTH_SESSIONS = 2;

/** Styrkan får ta högst så här stor del av veckans timmar. */
const MAX_STRENGTH_SHARE = 0.25;

/** Ett underhållspass tar högst så här stor del av konditionstiden. */
const MAINTENANCE_SHARE = 0.25;

/** Kortaste pass vi skriver ut. */
const MIN_SESSION_HOURS = 0.5;

/** Öppningspasset dagen före ett lopp: kort och lugnt, bara för att känna efter. */
const OPENER_HOURS = 0.5;

function roundDown(hours: number): number {
  return Math.floor(hours * 2) / 2;
}

/** Veckans budget innan loppet räknats av. */
export function weeklyHours(week: PhasedWeek, hoursPerWeek: number): number {
  const load = PHASE_LOAD[week.phase] * (week.followsRace ? AFTER_RACE_LOAD : 1);
  return roundDown(Math.min(hoursPerWeek, hoursPerWeek * load * progression(week.weeksUntilRace)));
}

/**
 * Stegringen inom en fas.
 *
 * Tolv veckor på exakt samma volym är ingen uppbyggnad utan en platå. Volymen
 * växer därför gradvis ju närmare loppet veckan ligger, och faller tillbaka på
 * nedtrappnings- och återhämtningsveckor genom fasens egen faktor.
 */
function progression(weeksUntilRace: number): number {
  return 0.85 + 0.15 * rampProgress(weeksUntilRace);
}

/** Hur långt uppbyggnaden hunnit: 0 längst bort från loppet, 1 närmast. */
function rampProgress(weeksUntilRace: number): number {
  if (!Number.isFinite(weeksUntilRace)) return 0;
  const done = (LONG_RAMP_WEEKS - weeksUntilRace) / LONG_RAMP_WEEKS;
  return Math.min(1, Math.max(0, done));
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

/**
 * Längsta långpass som får planeras i en gren den här veckan.
 *
 * Taket växer mot loppet: längst bort är det 40 procent av grenens maxpass, de
 * sista veckorna före loppet är det fullt.
 */
export function longSessionCeiling(discipline: Discipline, weeksUntilRace: number): number {
  const cap = MAX_SESSION_HOURS[discipline];
  const share = LONG_RAMP_FLOOR + (1 - LONG_RAMP_FLOOR) * rampProgress(weeksUntilRace);
  return roundDown(cap * share);
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
  const raceLoad = week.raceDate === undefined ? 0 : raceHours(input, week.targetRace);
  const budget = roundDown(Math.max(0, weeklyHours(week, input.hoursPerWeek) - raceLoad));

  const raceDay = week.raceDate === undefined ? undefined : weekdayOf(week.raceDate);
  const schedule = {
    ...input.trainingDays,
    unavailableDays: [...input.trainingDays.unavailableDays, ...blockedDays(raceDay)],
  };

  // Öppningspasset dagen före loppet tar en av veckans träningsdagar.
  const opener = openerDay(raceDay, input);
  const slots = Math.max(
    0,
    Math.min(input.trainingDays.daysPerWeek - (opener === undefined ? 0 : 1), trainingDaysOfWeek(schedule, 7).length),
  );

  const planned = planWeek(week, input, budget, slots);
  const placed = assignDays(planned, schedule, slots);
  if (opener !== undefined) placed.push(openerSession(week, opener));

  return placed.map((session) => withSeason(session, week.startDate, input));
}

/** Uppskattad tid i loppet, som belastning i loppveckan. */
function raceHours(input: PlanInput, discipline: Discipline): number {
  return estimatedRaceHours(input.variant, discipline, input.engelbrektsloppet);
}

/**
 * Veckans pass, i prioritetsordning.
 *
 * Platserna i veckan är lika begränsade som timmarna. Fördelningen är därför
 * uttalad: nyckelpassen först, sedan nybörjargrenarna som ska hållas igång, och
 * sist styrkan. Räcker inte dagarna är det styrkan som faller bort — aldrig den
 * enda simningen i veckan.
 */
function planWeek(
  week: PhasedWeek,
  input: PlanInput,
  budget: number,
  slots: number,
): PlannedSession[] {
  if (budget < MIN_SESSION_HOURS || slots < 1) return [];

  const others = activeDisciplines(week.targetRace, input.levels).filter(
    (discipline) => discipline !== week.targetRace,
  );

  // Styrkan tar timmar men ingen egen dag — den läggs på en dag som redan har
  // ett konditionspass, vilket är så folk faktiskt gör det.
  const strengthSlots = Math.min(
    strengthCount(week.phase),
    MAX_STRENGTH_SESSIONS,
    Math.floor((budget * MAX_STRENGTH_SHARE) / STRENGTH_HOURS),
  );
  const strengthHours = Math.max(0, strengthSlots) * STRENGTH_HOURS;
  const forEndurance = budget - strengthHours;

  const keySlots = Math.min(2, slots);
  const maintenanceSlots = Math.min(others.length, Math.max(0, slots - keySlots));

  const maintenance: PlannedSession[] = others.slice(0, maintenanceSlots).map((discipline) => ({
    discipline,
    hours: capped(discipline, roundDown(Math.min(forEndurance * MAINTENANCE_SHARE, 1.5))),
    purpose: maintenancePurpose(discipline, input.levels[discipline]),
    priority: 'supporting',
    long: false,
  }));
  const maintenanceHours = maintenance.reduce((sum, session) => sum + session.hours, 0);

  const target = targetSessions(
    week,
    forEndurance - maintenanceHours,
    budget,
    input.goals[week.targetRace],
    Math.max(0, slots - maintenanceSlots),
  );

  const strength: PlannedSession[] = Array.from({ length: Math.max(0, strengthSlots) }, () => ({
    discipline: week.targetRace,
    hours: STRENGTH_HOURS,
    purpose: 'strength' as const,
    priority: 'supporting' as const,
    long: false,
  }));

  return [...target, ...maintenance, ...strength].filter(
    (session) => session.hours >= MIN_SESSION_HOURS,
  );
}

/** Öppningspassets dag, när ett lopp går och dagen före är möjlig. */
function openerDay(raceDay: Weekday | undefined, input: PlanInput): Weekday | undefined {
  if (raceDay === undefined) return undefined;
  const dayBefore = previousDay(raceDay);
  return input.trainingDays.unavailableDays.includes(dayBefore) ? undefined : dayBefore;
}

/** Kort och lugnt dagen före loppet, bara för att känna efter. */
function openerSession(week: PhasedWeek, day: Weekday): PlannedSession & { day: Weekday } {
  return {
    discipline: week.targetRace,
    hours: OPENER_HOURS,
    purpose: 'easy',
    priority: 'supporting',
    long: false,
    day,
  };
}

function strengthCount(phase: Phase): number {
  switch (phase) {
    case 'base':
    case 'build':
      return 2;
    case 'peak':
    case 'recovery':
      return 1;
    case 'taper':
      return 0;
  }
}

/**
 * Nästa lopps pass: ett långpass och ett kvalitetspass, båda nyckelpass.
 *
 * Långpasset begränsas av tre saker: grenens tak, veckans andel, och hur långt
 * uppbyggnaden hunnit. Timmar som inte får plats läggs i ett extra lugnt pass i
 * samma gren i stället för att blåsa upp ett pass till orimlig längd.
 */
function targetSessions(
  week: PhasedWeek,
  hours: number,
  weekBudget: number,
  goal: Goal,
  slots: number,
): PlannedSession[] {
  if (hours < MIN_SESSION_HOURS || slots < 1) return [];

  const discipline = week.targetRace;
  const quality = slots < 2 ? 0 : capped(discipline, roundDown(hours * QUALITY_SHARE[goal]));
  // Långpasset mäts mot hela veckan, inte mot det som råkar bli över. Annars
  // blir det aldrig långt nog för ett lopp på 315 km.
  const ceiling = Math.min(
    longSessionCeiling(discipline, week.weeksUntilRace),
    Math.max(MIN_SESSION_HOURS, roundDown(weekBudget * MAX_LONG_SHARE)),
  );
  const long = Math.min(capped(discipline, roundDown(hours - quality)), ceiling);

  const sessions: PlannedSession[] = [
    { discipline, hours: long, purpose: longPurpose(week.phase), priority: 'key', long: true },
    {
      discipline,
      hours: quality,
      purpose: qualityPurpose(week.phase),
      priority: 'key',
      long: false,
    },
  ];

  // Timmar som inte fick plats i långpasset blir egna lugna pass, ett per dag
  // som är kvar. Timmarna ska inte försvinna bara för att taket slog i.
  let leftover = roundDown(hours - long - quality);
  let free = slots - sessions.length;
  while (leftover >= MIN_SESSION_HOURS && free > 0) {
    const hoursForSession = capped(discipline, free === 1 ? leftover : roundDown(leftover / free));
    sessions.push({
      discipline,
      hours: hoursForSession,
      purpose: 'easy',
      priority: 'supporting',
      long: false,
    });
    leftover = roundDown(leftover - hoursForSession);
    free -= 1;
  }

  return sessions.filter((session) => session.hours >= MIN_SESSION_HOURS);
}

/** Aldrig längre än vad grenen tål. */
function capped(discipline: Discipline, hours: number): number {
  return Math.min(hours, MAX_SESSION_HOURS[discipline]);
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
 * Loppdagen och dagen före är fredade: man tränar inte på loppdagen, och dagen
 * före får bara ett kort öppningspass. Långpasset får användarens önskade dag,
 * resten sprids ut över veckan.
 */
function assignDays(
  planned: readonly PlannedSession[],
  schedule: TrainingDays,
  slots: number,
): (PlannedSession & { day: Weekday })[] {
  const endurance = planned.filter((session) => session.purpose !== 'strength');
  const strength = planned.filter((session) => session.purpose === 'strength');

  const days = trainingDaysOfWeek({ ...schedule, daysPerWeek: slots }, endurance.length);
  if (days.length === 0) return [];

  const longDay = preferredLongDay({ ...schedule, daysPerWeek: slots });
  const rest = days.filter((day) => day !== longDay);

  let next = 0;
  const placed = endurance.slice(0, days.length).map((session) => {
    if (session.long) return { ...session, day: longDay };
    const day = rest[next] ?? longDay;
    next += 1;
    return { ...session, day };
  });

  // Styrkan delar dag med ett konditionspass — men aldrig med långpasset, och
  // aldrig två styrkepass på samma dag.
  const shareable = rest.length > 0 ? rest : days;
  for (const [index, session] of strength.entries()) {
    const day = shareable[index % shareable.length];
    if (day !== undefined && index < shareable.length) {
      placed.push({ ...session, day });
    }
  }

  return placed;
}

/** Loppdagen och dagen före är inte träningsdagar. */
function blockedDays(raceDay: Weekday | undefined): Weekday[] {
  return raceDay === undefined ? [] : [raceDay, previousDay(raceDay)];
}

function previousDay(day: Weekday): Weekday {
  return (day === 1 ? 7 : day - 1) as Weekday;
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
