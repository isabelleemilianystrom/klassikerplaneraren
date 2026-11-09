/**
 * Pass per vecka — steg 3 i genereringen, och motorns ingång.
 *
 * Här blir veckans minuter konkreta pass med dag, längd, zon, titel och
 * instruktion. Den här modulen **sätter samman** veckan; varje del av arbetet
 * bor i en egen modul:
 *
 * | Modul | Vad den gör |
 * | --- | --- |
 * | `long-session.ts` | Veckans längsta pass och dess dag (R-13, R-28, R-46) |
 * | `endurance.ts` | Minuterna blir pass, gren för gren (R-12, R-15, R-40, R-42) |
 * | `placement.ts` | Vilken dag varje pass hamnar på (R-11, R-14, R-16, R-43) |
 * | `session-texts.ts` | Titel, instruktion, ersättning och alternativ (R-17, R-30, R-37) |
 * | `session-limits.ts` | Golv, tak, zoner och veckokrav som alla frågar om |
 * | `season.ts` | Snö, öppet vatten och utrustning (R-17, R-19, R-20) |
 *
 * Ordningen i `buildWeekPlan` är medvetet den här:
 *
 *   1. Loppet och öppningspasset läggs först — de har fasta dagar (R-04).
 *   2. Veckans dagar räknas: en dag bär ett pass (R-42), så dagarna avgör hur
 *      många pass veckan rymmer och hur långa de blir.
 *   3. Långpasset får sin del av veckan därefter (R-13, R-28).
 *   4. Styrkan tar sin egen dag (R-10, R-42).
 *   5. Resten blir konditionspass per gren.
 *
 * Långpasset ligger tidigt i kön med flit. Lärdomen från v0 är att det annars
 * alltid blir för kort: ligger det sist efter styrka och kvalitetspass är det
 * den post som är lättast att knapra på.
 *
 * `PendingSession` och `WeekPlan` exporteras härifrån och importeras som
 * **typer** av de andra modulerna. Typimporter erasas vid kompilering, så
 * ingen cirkel uppstår även om beroendet går båda vägar.
 *
 * Rena funktioner, inga sidoeffekter. Alla siffror kommer ur `config/rules.json`.
 */
import { weekBudgets, type WeekBudget } from './budget.ts';
import { raceById, rules } from './config.ts';
import { addDays } from './dates.ts';
import type {
  IsoDate,
  PlanInput,
  PreferredDays,
  RaceId,
  Session,
  SessionType,
  TrainedSport,
  Zone,
} from './types.ts';
import { enduranceSessions, strengthSessions } from './endurance.ts';
import { longSession } from './long-session.ts';
import {
  carryOver,
  INGET_FÖRE,
  placeOnDays,
  trainingDates,
  type CarriedOver,
} from './placement.ts';
import { withTitleAndInstruction } from './session-texts.ts';
import { withRaceRehearsal } from './rehearsal.ts';
import { withVolumeEncouragement } from './volume.ts';
import type { WeekContext, WeekDays } from './week-context.ts';
import { buildWeeks, placeRaces, type PlacedRace, type WeekSkeleton } from './weeks.ts';

/** En vecka med sina pass. */
export interface WeekPlan {
  week: WeekSkeleton;
  budget: WeekBudget;
  sessions: Session[];
  /** Summan av passens minuter, loppet inräknat. Veckans faktiska tid (R-29). */
  totalMinutes: number;
}

/** Ett pass innan det fått dag, titel och instruktion. */
export interface PendingSession {
  sport: TrainedSport | 'strength';
  type: SessionType;
  minutes: number;
  zone: Zone | null;
  /** Satt för pass som måste ligga en bestämd dag: lopp, öppningspass, långpass. */
  fixedDate?: IsoDate;
  /** Satt på lopppass. Användarens valda datum behöver inte finnas i konfigurationen. */
  raceId?: RaceId;
}

/**
 * De valda dagarna måste vara olika.
 *
 * Vilodagen ska vara helt fri, så den kan inte också bära veckans längsta
 * pass. Formuläret hindrar det (K-04), men motorn litar inte på det.
 */
function requireDistinctDays(preferredDays: PreferredDays): void {
  if (preferredDays.longSession === preferredDays.rest) {
    throw new Error(
      `Långpassdagen och vilodagen kan inte vara samma dag (båda är ${preferredDays.rest})`,
    );
  }
}

/**
 * Timmarna måste vara ett heltal inom R-41:s intervall.
 *
 * Formuläret håller gränsen redan, men lagringen är otrodd indata: en
 * handskriven `hoursPerWeek: 1000000` gav sextio miljoner minuter att dela ut
 * per vecka och låste webbläsaren. Motorn vägrar hellre än att försöka.
 */
function requirePlannableHours(hoursPerWeek: number): void {
  const { byHoursPerWeek } = rules.trainingDays;
  const max = byHoursPerWeek.at(-1)?.upToHours ?? 15;
  const min = rules.weeklyHours.min;

  const rimligt = Number.isInteger(hoursPerWeek) && hoursPerWeek >= min && hoursPerWeek <= max;
  if (rimligt) return;

  throw new Error(`Timmar per vecka ska vara ett heltal mellan ${min} och ${max}, inte ${hoursPerWeek}`);
}

/** Hela planens veckor med pass. */
export { trainingDayCount } from './placement.ts';

export function buildWeekPlans(input: PlanInput): WeekPlan[] {
  requireDistinctDays(input.preferredDays);
  requirePlannableHours(input.hoursPerWeek);

  const weeks = buildWeeks(input);
  const budgets = weekBudgets(input);
  const races = placeRaces(input);

  // Veckorna byggs i ordning, inte oberoende av varandra: R-16 gäller också
  // över veckogränsen. Ett hårt pass på söndagen får inte följas av ett hårt
  // pass på måndagen i nästa vecka.
  const resultat: WeekPlan[] = [];
  let före: CarriedOver = INGET_FÖRE;

  for (const [i, week] of weeks.entries()) {
    const plan = buildWeekPlan(
      week,
      budgets[i] as WeekBudget,
      input,
      races,
      weeks,
      före,
    );
    resultat.push(plan);
    före = carryOver(plan);
  }

  // R-48 och R-49 läggs sist. Båda behöver hela planen för att veta var texten
  // hör hemma — R-48 summerar kilometrarna, R-49 letar grenens sista pass före
  // nedtrappningen — så de kommer efter att veckorna är byggda, inte inne i dem.
  return withRaceRehearsal(withVolumeEncouragement(resultat, input), input);
}

function buildWeekPlan(
  week: WeekSkeleton,
  budget: WeekBudget,
  input: PlanInput,
  races: readonly PlacedRace[],
  allWeeks: readonly WeekSkeleton[],
  before: CarriedOver,
): WeekPlan {
  const dates = weekDates(week, input);
  const pending: PendingSession[] = [];

  const raceDates = new Set<IsoDate>();
  const openerDates = new Set<IsoDate>();

  // 1. Loppen och öppningspassen. Fasta dagar, utanför budgeten (R-04, R-25).
  for (const race of races.filter((kandidat) => kandidat.weekIndex === week.index - 1)) {
    pending.push(raceSession(race));
    raceDates.add(race.date);

    const opener = openerFor(race, dates, raceDates);
    if (opener !== null) {
      pending.push(opener);
      openerDates.add(opener.fixedDate as IsoDate);
    }
  }

  // 2. Veckans dagar. R-42 ger en dag ett pass, så antalet dagar avgör både
  //    hur många pass veckan rymmer och hur lång var och en blir.
  const styrka = strengthSessions(budget);
  const dagar = trainingDates(
    input,
    dates,
    raceDates,
    openerDates,
    planeradePerDag(dates, pending),
  );
  // Noll är ett giltigt svar: en avkortad första vecka (R-01) kan ha alla
  // dagar upptagna av styrkan, och då ska inga konditionspass byggas. Ett golv
  // på en plats tvingade fram pass som fick staplas på en upptagen dag.
  const platser = Math.max(0, dagar.length - styrka.length);

  // 3. Långpasset (R-13, R-28).
  const ctx: WeekContext = { week, allWeeks, budget, input, races, slots: platser };
  const days: WeekDays = {
    all: dates,
    raceDates,
    openerDates,
    preferred: input.preferredDays,
  };

  const long = longSession(ctx, days);
  if (long !== null) pending.push(long);

  // 4. Styrkan (R-10, R-42). Egen dag, så den tar en av veckans dagar.
  pending.push(...styrka);

  // 5. Konditionen, sport för sport (R-12, R-15).
  //
  // R-42 ger en dag ett pass, så veckan rymmer aldrig fler konditionspass än
  // den har dagar kvar när styrkan och långpasset tagit sina. Byggs det fler
  // måste placeringen lägga två på samma dag, och då faller både den regeln
  // och R-14 om löpning två dagar i rad.
  const kvarPlatser = Math.max(0, platser - (long === null ? 0 : 1));

  pending.push(
    ...enduranceSessions(week, budget, input, long, races, kvarPlatser, dates.length === 7),
  );

  const placed = placeOnDays(pending, week, input, dates, raceDates, openerDates, before);
  const withTexts = placed.map((session, i) => withTitleAndInstruction(session, week, i, input));

  return {
    week,
    budget: withUnplacedMinutes(budget, withTexts),
    sessions: withTexts,
    totalMinutes: withTexts.reduce((summa, session) => summa + session.minutes, 0),
  };
}

/**
 * Budgeten med de minuter som inte gick att lägga i ett pass (R-29).
 *
 * Normalfallet är noll. Mer än noll uppstår när varje gren veckan har slagit i
 * ett tak: nybörjartaket i R-31, eller grenens passtak i R-40 — en vecka kan
 * ge simningen 111 minuter, och nittio är det längsta pass som blir av. Går de
 * minuterna inte till någon annan gren heller är veckans faktiska tid lägre än
 * den valda, och det ska stå i budgeten i stället för att tystas ner.
 *
 * Loppet och öppningspasset ligger utanför budgeten (R-04, R-25) och räknas
 * inte med.
 */
function withUnplacedMinutes(budget: WeekBudget, sessions: readonly Session[]): WeekBudget {
  const öppningspass = sessions.filter((session) =>
    sessions.some(
      (kandidat) =>
        kandidat.type === 'race' &&
        kandidat.sport === session.sport &&
        kandidat.date === addDays(session.date, 1),
    ),
  );

  const placerat = sessions
    .filter((session) => session.type !== 'race' && !öppningspass.includes(session))
    .reduce((summa, session) => summa + session.minutes, 0);

  const budgeterat = budget.enduranceMinutes + budget.strengthMinutes;
  const kvar = Math.max(0, budgeterat - placerat);

  return kvar === budget.unplacedMinutes ? budget : { ...budget, unplacedMinutes: kvar };
}

/** Passen med fast dag, grupperade per dag — vad `trainingDates` behöver. */
function planeradePerDag(
  dates: readonly IsoDate[],
  pending: readonly PendingSession[],
): Map<IsoDate, PendingSession[]> {
  const karta = new Map<IsoDate, PendingSession[]>(dates.map((datum) => [datum, []]));

  for (const session of pending) {
    if (session.fixedDate === undefined) continue;
    karta.get(session.fixedDate)?.push(session);
  }

  return karta;
}

/**
 * Veckans datum, måndag till söndag — utom de som redan passerat (R-01).
 *
 * Planen börjar på måndagen i startdatumets vecka, så den första veckan kan
 * ha dagar före startdatumet. De är inte träningsdagar: en plan som visar
 * pass på gårdagen är en plan man inte kan följa, och det var det F-1 ur den
 * slumpade egenskapstestningen hittade — 172 av 200 planer, eftersom alla sex
 * referensprofiler råkade börja på en måndag.
 *
 * Veckan blir då kortare, och `phaseBudget` skalar tiden efter det.
 */
function weekDates(week: WeekSkeleton, input: PlanInput): IsoDate[] {
  return [0, 1, 2, 3, 4, 5, 6]
    .map((offset) => addDays(week.startDate, offset))
    .filter((datum) => datum >= input.startDate);
}

/** Loppdagen innehåller bara loppet (R-04). */
function raceSession(race: PlacedRace): PendingSession {
  const config = raceById(race.id);
  return {
    sport: config.sport as TrainedSport,
    type: 'race',
    minutes: Math.round(config.estimatedHours * 60),
    zone: null,
    fixedDate: race.date,
    raceId: race.id,
  };
}

/**
 * Öppningspasset dagen före loppet (R-04).
 *
 * Det ligger utanför veckans budget, precis som loppet självt. Loppveckans
 * budget är ofta noll — Vasaloppet tar sju timmar av en vecka på två — och ett
 * kort öppningspass hör ändå till loppet.
 *
 * Faller dagen före på ett annat lopp, eller utanför veckan, blir det inget
 * öppningspass.
 */
function openerFor(
  race: PlacedRace,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
): PendingSession | null {
  const dagenFöre = addDays(race.date, -1);
  if (!dates.includes(dagenFöre) || raceDates.has(dagenFöre)) return null;

  return {
    sport: raceById(race.id).sport as TrainedSport,
    type: 'easy',
    minutes: rules.raceDay.openerMinutesDayBefore,
    zone: Math.min(2, rules.raceDay.openerMaxZone) as Zone,
    fixedDate: dagenFöre,
  };
}
