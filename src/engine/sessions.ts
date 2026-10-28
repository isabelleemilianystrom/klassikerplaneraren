/**
 * Pass per vecka — steg 3 i genereringen.
 *
 * Här blir veckans minuter konkreta pass med dag, längd, zon, titel och
 * instruktion. Budgeten från T-04 säger hur många minuter varje sport får;
 * den här modulen bestämmer hur de delas upp och vilka dagar de hamnar på.
 *
 * Ordningen är medvetet den här:
 *
 *   1. Loppet och öppningspasset läggs först — de har fasta dagar (R-04).
 *   2. Långpasset får sin del av veckan därefter (R-13, R-28).
 *   3. Styrkan tar sina pass (R-10).
 *   4. Resten blir konditionspass per sport.
 *
 * Långpasset ligger tidigt i kön med flit. Lärdomen från v0 är att det annars
 * alltid blir för kort: ligger det sist efter styrka och kvalitetspass är det
 * den post som är lättast att knapra på.
 *
 * Rena funktioner, inga sidoeffekter. Alla siffror kommer ur `config/rules.json`.
 */
import { weekBudgets, type WeekBudget } from './budget';
import { raceById, rules, sessions as sessionTexts } from './config';
import { addDays, weekdayOf } from './dates';
import type {
  IsoDate,
  Level,
  Phase,
  PlanInput,
  PreferredDays,
  RaceId,
  Session,
  SessionType,
  TrainedSport,
  Zone,
} from './types';
import { buildWeeks, placeRaces, type PlacedRace, type WeekSkeleton } from './weeks';

/** En vecka med sina pass. */
export interface WeekPlan {
  week: WeekSkeleton;
  budget: WeekBudget;
  sessions: Session[];
  /** Summan av passens minuter, loppet inräknat. Veckans faktiska tid (R-29). */
  totalMinutes: number;
}

/** Ett pass innan det fått dag, titel och instruktion. */
interface PendingSession {
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

/** Hela planens veckor med pass. */
export function buildWeekPlans(input: PlanInput): WeekPlan[] {
  requireDistinctDays(input.preferredDays);

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

  return resultat;
}

/**
 * Det föregående veckan behöver skicka vidare.
 *
 * R-14 och R-16 handlar båda om dagar i rad, och veckogränsen är inte något
 * reglerna känner av. Utan det här kunde söndag och måndag båda bli hårda.
 */
interface CarriedOver {
  hardDates: ReadonlySet<IsoDate>;
  runDates: ReadonlySet<IsoDate>;
}

const INGET_FÖRE: CarriedOver = { hardDates: new Set(), runDates: new Set() };

function carryOver(plan: WeekPlan): CarriedOver {
  return {
    hardDates: new Set(
      plan.sessions
        .filter((session) => session.zone !== null && session.zone >= 3)
        .map((session) => session.date),
    ),
    runDates: new Set(
      plan.sessions
        .filter((session) => session.sport === 'run' && session.type !== 'race')
        .map((session) => session.date),
    ),
  };
}

function buildWeekPlan(
  week: WeekSkeleton,
  budget: WeekBudget,
  input: PlanInput,
  races: readonly PlacedRace[],
  allWeeks: readonly WeekSkeleton[],
  before: CarriedOver,
): WeekPlan {
  const dates = weekDates(week);
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

  // 2. Långpasset (R-13, R-28).
  const long = longSession(week, budget, dates, raceDates, openerDates, allWeeks, input.preferredDays);
  if (long !== null) pending.push(long);

  // 3. Styrkan (R-10).
  pending.push(...strengthSessions(budget));

  // 4. Konditionen, sport för sport (R-12, R-15).
  pending.push(...enduranceSessions(week, budget, input, long));

  const placed = placeOnDays(pending, week, input, dates, raceDates, openerDates, before);
  const withTexts = placed.map((session, i) => withTitleAndInstruction(session, week, i));

  return {
    week,
    budget,
    sessions: withTexts,
    totalMinutes: withTexts.reduce((summa, session) => summa + session.minutes, 0),
  };
}

/** Veckans sju datum, måndag till söndag. */
function weekDates(week: WeekSkeleton): IsoDate[] {
  return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(week.startDate, offset));
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

/**
 * Veckans långpass i loppets sport (R-13, R-28).
 *
 * Passet ligger på den dag användaren valt och växer jämnt genom fasen: det börjar
 * på halva sitt tak och når taket i fasens sista vecka. Tre tak gäller
 * samtidigt — sportens tak i R-13, 70 procent av veckans tid i R-28, och den
 * tid sporten faktiskt har fått i veckan.
 *
 * Blir resultatet kortare än `longSession.minMinutes` är det inget långpass,
 * och veckan får i stället vanliga konditionspass.
 */
function longSession(
  week: WeekSkeleton,
  budget: WeekBudget,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  allWeeks: readonly WeekSkeleton[],
  preferredDays: PreferredDays,
): PendingSession | null {
  if (week.phase !== 'specific' || week.focusRaceId === null) return null;

  const sport = raceById(week.focusRaceId).sport as TrainedSport;
  const tillgängligt = budget.bySport[sport] ?? 0;
  if (tillgängligt === 0) return null;

  const cap = rules.longSession.capMinutesBySport[sport];
  const { startShareOfCap, maxShareOfWeek } = rules.longSession;

  // Hur långt genom fasen veckan ligger: 1/n i första veckan, 1 i den sista.
  const iFasen = allWeeks.filter((kandidat) => kandidat.phaseId === week.phaseId);
  const position = iFasen.findIndex((kandidat) => kandidat.index === week.index) + 1;
  const andelGenomFasen = position / iFasen.length;

  const växande = cap * (startShareOfCap + (1 - startShareOfCap) * andelGenomFasen);

  const minuter = Math.min(
    Math.round(växande),
    cap,
    Math.floor(budget.enduranceMinutes * maxShareOfWeek),
    tillgängligt,
    rules.session.maxMinutes,
  );

  if (minuter < rules.longSession.minMinutes) return null;

  const dag = longSessionDate(dates, raceDates, openerDates, preferredDays);
  if (dag === null) return null;

  return { sport, type: 'long', minutes: minuter, zone: 2, fixedDate: dag };
}

/**
 * Dagen långpasset läggs på (R-13).
 *
 * Användarens valda dag går först. Är den upptagen av ett lopp eller ett
 * öppningspass tas den sista fria av standarddagarna i konfigurationen, och
 * sist någon annan fri dag — hellre ett långpass på fel dag än inget långpass.
 *
 * Vilodagen hålls fri även här. Den som har bett om en fri söndag ska inte få
 * veckans längsta pass just då.
 */
function longSessionDate(
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  preferredDays: PreferredDays,
): IsoDate | null {
  const fria = dates.filter(
    (datum) =>
      !raceDates.has(datum) &&
      !openerDates.has(datum) &&
      weekdayOf(datum) !== preferredDays.rest,
  );

  const vald = fria.find((datum) => weekdayOf(datum) === preferredDays.longSession);
  if (vald !== undefined) return vald;

  const standard = fria.filter((datum) =>
    rules.longSession.allowedWeekdays.includes(weekdayOf(datum)),
  );

  return standard.at(-1) ?? fria.at(-1) ?? null;
}

/** Styrkans pass, 20 minuter styck (R-10). */
function strengthSessions(budget: WeekBudget): PendingSession[] {
  const längd = rules.strength.minutesPerSession;
  const antal = Math.floor(budget.strengthMinutes / längd);

  return Array.from({ length: antal }, () => ({
    sport: 'strength' as const,
    type: 'strength' as SessionType,
    minutes: längd,
    zone: null,
  }));
}

/**
 * Konditionspassen, sport för sport (R-12, R-15).
 *
 * Varje sports minuter delas i så många pass som de räcker till, med
 * `session.minMinutes` som golv. Räcker de inte till ett enda pass får sporten
 * stå över veckan, och dess minuter går till de sporter som får plats — de
 * försvinner aldrig (R-29).
 */
function enduranceSessions(
  week: WeekSkeleton,
  budget: WeekBudget,
  input: PlanInput,
  long: PendingSession | null,
): PendingSession[] {
  const kvarPerSport = remainingBySport(budget, long);
  const fördelat = foldAwayTooSmallSports(kvarPerSport, week);
  const hårda = hardSessionPlan(week, input);

  const resultat: PendingSession[] = [];

  for (const [sport, minuter] of fördelat) {
    // Långpasset ska vara veckans längsta pass. Har sporten ett långpass får
    // dess övriga pass därför inte bli längre än det — annars blir "långpasset"
    // kortast av allt, vilket är precis felet från v0.
    const tak = long !== null && long.sport === sport ? long.minutes : rules.session.maxMinutes;

    for (const längd of splitIntoSessions(minuter, tak)) {
      const hård = hårda.get(sport)?.pop();
      resultat.push({
        sport,
        type: hård?.type ?? 'easy',
        minutes: längd,
        zone: hård?.zone ?? 2,
      });
    }
  }

  return distributeLeftover(resultat, budget, long);
}

/**
 * Minuter som inte fick plats läggs på befintliga pass (R-29).
 *
 * Ett vanligt fall: cykeln får 319 minuter, långpasset tar sitt tak på 300 och
 * de 19 som blir kvar räcker inte till ett eget pass. De minuterna ska inte
 * försvinna — användaren har sagt vad hon kan träna, och ett program som
 * använder mindre än det ser ut att ha räknat fel.
 *
 * De läggs på det kortaste passet först, så att veckan blir jämnare och inget
 * pass växer förbi sitt tak i R-12.
 */
function distributeLeftover(
  endurance: readonly PendingSession[],
  budget: WeekBudget,
  long: PendingSession | null,
): PendingSession[] {
  const resultat = endurance.map((session) => ({ ...session }));

  const planerat =
    resultat.reduce((summa, session) => summa + session.minutes, 0) + (long?.minutes ?? 0);
  let kvar = budget.enduranceMinutes - planerat;
  if (kvar <= 0 || resultat.length === 0) return resultat;

  // En minut i taget på det kortaste passet som får växa. Enkelt och alltid
  // samma resultat för samma indata.
  while (kvar > 0) {
    const kanVäxa = resultat.filter((session) => session.minutes < rules.session.maxMinutes);
    if (kanVäxa.length === 0) break;

    const kortast = kanVäxa.reduce((a, b) => (b.minutes < a.minutes ? b : a));
    kortast.minutes += 1;
    kvar -= 1;
  }

  return resultat;
}

/** Minuter per sport efter att långpasset tagit sin del. */
function remainingBySport(
  budget: WeekBudget,
  long: PendingSession | null,
): Map<TrainedSport, number> {
  const kvar = new Map<TrainedSport, number>();

  for (const [sport, minuter] of Object.entries(budget.bySport) as [TrainedSport, number][]) {
    const avdrag = long !== null && long.sport === sport ? long.minutes : 0;
    kvar.set(sport, minuter - avdrag);
  }

  return kvar;
}

/**
 * Sporter som inte räcker till ett pass får stå över, och deras minuter
 * fördelas på de övriga (R-12, R-29).
 *
 * Vilken sport som står över roterar med veckonumret. Lärdomen från v0 är att
 * en fast ordning gör att samma gren alltid väljs bort — och då tränas en
 * fjärde gren aldrig, vilket är värst för den som är nybörjare i just den.
 */
function foldAwayTooSmallSports(
  bySport: ReadonlyMap<TrainedSport, number>,
  week: WeekSkeleton,
): [TrainedSport, number][] {
  const golv = rules.session.minMinutes;
  const alla = [...bySport.entries()].filter(([, minuter]) => minuter > 0);
  if (alla.length === 0) return [];

  const totalt = alla.reduce((summa, [, minuter]) => summa + minuter, 0);
  if (totalt < golv) return [];

  // Så många sporter som veckans tid räcker till, högst så många som finns.
  const antal = Math.min(alla.length, Math.floor(totalt / golv));

  // Rotationen: veckonumret avgör var i listan urvalet börjar.
  const start = (week.index - 1) % alla.length;
  const roterad = [...alla.slice(start), ...alla.slice(0, start)];

  // De sporter som har mest tid först, så att rotationen bara avgör lika fall.
  const valda = [...roterad].sort((a, b) => b[1] - a[1]).slice(0, antal);

  // De bortvalda minuterna fördelas på de valda, i proportion till deras tid.
  const valdTid = valda.reduce((summa, [, minuter]) => summa + minuter, 0);
  const över = totalt - valdTid;

  const resultat: [TrainedSport, number][] = valda.map(([sport, minuter]) => [
    sport,
    minuter + Math.floor((över * minuter) / valdTid),
  ]);

  // Avrundningsresten läggs på den sport som har mest tid, så inget tappas.
  const summa = resultat.reduce((a, [, minuter]) => a + minuter, 0);
  const första = resultat[0];
  if (första !== undefined) första[1] += totalt - summa;

  return resultat;
}

/**
 * En sports minuter delade i pass som alla ligger inom R-12.
 *
 * `maxLength` är det längsta ett enskilt pass får bli. Normalt är det taket i
 * R-12, men har sporten ett långpass i veckan är det långpassets längd — inget
 * vanligt pass får bli längre än veckans långpass.
 *
 * Två pass per sport och vecka är grundregeln. Fler blir det bara när taket
 * kräver det, för fler än så gör veckan svår att överblicka.
 */
function splitIntoSessions(minutes: number, maxLength: number): number[] {
  const { minMinutes } = rules.session;
  if (minutes < minMinutes) return [];

  const taket = Math.min(maxLength, rules.session.maxMinutes);
  const flest = Math.floor(minutes / minMinutes);
  const antal = Math.min(flest, Math.max(2, Math.ceil(minutes / taket)));

  const grund = Math.floor(minutes / antal);
  const rest = minutes - grund * antal;

  return Array.from({ length: antal }, (_, i) => grund + (i < rest ? 1 : 0));
}

/** Ett hårt pass med sin zon. */
interface HardSession {
  type: SessionType;
  zone: Zone;
}

/**
 * Veckans hårda pass fördelade på sporter (R-15).
 *
 * Bas ger ett tröskelpass i zon 3. Specifik fas ger ett tröskelpass och ett
 * intervallpass i zon 4, men nivå Ny i sporten får aldrig zon 4 — tekniken
 * håller inte för den intensiteten än. Nedtrappning ger ett kort inslag i
 * zon 3 och återhämtning inget alls.
 *
 * De hårda passen går till loppets sport i första hand. Det är den sport
 * veckan handlar om.
 */
function hardSessionPlan(week: WeekSkeleton, input: PlanInput): Map<TrainedSport, HardSession[]> {
  const plan = new Map<TrainedSport, HardSession[]>();
  const fas = rules.intensity.byPhase[week.phase];
  if (fas.hardSessionsPerWeek === 0) return plan;

  // Utan fokuslopp finns ingen sport som veckan handlar om, och därmed inget
  // pass som ska vara hårt.
  if (week.focusRaceId === null) return plan;
  const sport = raceById(week.focusRaceId).sport as TrainedSport;

  const maxZone = maxZoneFor(week.phase, input.levels[sport]);
  const hårda: HardSession[] = [];

  // Tröskelpasset i zon 3 kommer först, intervallpasset därefter.
  if (maxZone >= 3) hårda.push({ type: 'tempo', zone: 3 });
  if (fas.hardSessionsPerWeek >= 2 && maxZone >= 4) hårda.push({ type: 'intervals', zone: 4 });

  plan.set(sport, hårda.slice(0, fas.hardSessionsPerWeek));
  return plan;
}

/** Fasens högsta zon, nedsatt för den som är ny i sporten (R-15). */
function maxZoneFor(phase: Phase, level: Level | undefined): number {
  const fas = rules.intensity.byPhase[phase];
  const nedsatt = 'maxZoneForNewLevel' in fas ? fas.maxZoneForNewLevel : undefined;

  return level === 'new' && nedsatt !== undefined ? Math.min(fas.maxZone, nedsatt) : fas.maxZone;
}

/**
 * Passen placerade på veckans dagar (R-11, R-14, R-16).
 *
 * Pass med fast dag ligger redan rätt. De övriga fördelas på veckans
 * träningsdagar, som är så många som R-11 säger och alltid lämnar minst en hel
 * vilodag. Hårda pass skiljs åt så att de aldrig ligger två dagar i rad, och
 * den som är ny i löpning får aldrig löppass två dagar i rad.
 */
function placeOnDays(
  pending: readonly PendingSession[],
  week: WeekSkeleton,
  input: PlanInput,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  before: CarriedOver,
): Session[] {
  const perDag = new Map<IsoDate, PendingSession[]>(dates.map((datum) => [datum, []]));

  for (const session of pending) {
    if (session.fixedDate !== undefined) {
      (perDag.get(session.fixedDate) as PendingSession[]).push(session);
    }
  }

  const lediga = trainingDates(input, dates, raceDates, openerDates, perDag);
  const övriga = pending.filter((session) => session.fixedDate === undefined);

  for (const session of övriga) {
    const dag = bestDateFor(session, lediga, perDag, input, before);
    (perDag.get(dag) as PendingSession[]).push(session);
  }

  return toSessions(week, dates, perDag);
}

/**
 * Veckans träningsdagar (R-11).
 *
 * Antalet styrs av T. Loppdagar och dagen före ett lopp räknas bort — de är
 * redan upptagna av regler som väger tyngre. Minst en dag lämnas helt tom.
 */
function trainingDates(
  input: PlanInput,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
): IsoDate[] {
  const önskat = trainingDayCount(input.hoursPerWeek);
  const upptagna = dates.filter((datum) => raceDates.has(datum) || openerDates.has(datum));

  const kandidater = dates.filter(
    (datum) =>
      !raceDates.has(datum) &&
      !openerDates.has(datum) &&
      weekdayOf(datum) !== input.preferredDays.rest,
  );

  // Dagar som redan bär ett fast pass, till exempel långpasset, är med.
  const redanIBruk = dates.filter(
    (datum) =>
      (perDag.get(datum)?.length ?? 0) > 0 &&
      !raceDates.has(datum) &&
      !openerDates.has(datum),
  );

  const tak = Math.max(0, dates.length - rules.trainingDays.minRestDays - upptagna.length);
  const antal = Math.min(önskat, tak);

  const valda = new Set<IsoDate>(redanIBruk);
  for (const datum of ordnadeTräningsdagar(kandidater)) {
    if (valda.size >= antal) break;
    valda.add(datum);
  }

  return dates.filter((datum) => valda.has(datum));
}

/**
 * Träningsdagarna i den ordning de tas i bruk.
 *
 * Helgen först, eftersom de längsta passen hör dit, därefter varannan vardag
 * så att passen sprids ut i stället för att klumpa ihop sig i början av veckan.
 */
function ordnadeTräningsdagar(kandidater: readonly IsoDate[]): IsoDate[] {
  const helg = kandidater.filter((datum) => weekdayOf(datum) >= 6);
  const vardag = kandidater.filter((datum) => weekdayOf(datum) < 6);

  const varannan = [
    ...vardag.filter((_, i) => i % 2 === 0),
    ...vardag.filter((_, i) => i % 2 === 1),
  ];

  return [...helg, ...varannan];
}

/** Antal träningsdagar för veckotiden (R-11). */
export function trainingDayCount(hoursPerWeek: number): number {
  const rad = rules.trainingDays.byHoursPerWeek.find((kandidat) => hoursPerWeek <= kandidat.upToHours);
  return rad?.days ?? (rules.trainingDays.byHoursPerWeek.at(-1)?.days as number);
}

/**
 * Dagen som passar passet bäst (R-14, R-16).
 *
 * Reglerna rangordnas: ett hårt pass får aldrig hamna intill ett annat hårt
 * pass, och den som är ny i löpning får aldrig löpa två dagar i rad. Bland de
 * dagar som klarar det väljs den med minst tid inlagd, så att veckan blir jämn.
 */
function bestDateFor(
  session: PendingSession,
  dates: readonly IsoDate[],
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
  input: PlanInput,
  before: CarriedOver,
): IsoDate {
  const tillåtna = dates.filter((datum) =>
    allowedOn(session, datum, perDag, input, before),
  );
  const urval = tillåtna.length > 0 ? tillåtna : dates;

  return [...urval].sort((a, b) => {
    const tidA = minutesOn(a, perDag);
    const tidB = minutesOn(b, perDag);
    return tidA === tidB ? a.localeCompare(b) : tidA - tidB;
  })[0] as IsoDate;
}

function allowedOn(
  session: PendingSession,
  date: IsoDate,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
  input: PlanInput,
  before: CarriedOver,
): boolean {
  // R-16: aldrig zon 3–4 två dagar i rad.
  if (rules.intensity.noHardDaysBackToBack && isHard(session)) {
    const hårdDag = (datum: IsoDate) =>
      before.hardDates.has(datum) || dayHas(datum, perDag, isHard);

    if (hårdDag(date) || hårdDag(addDays(date, -1)) || hårdDag(addDays(date, 1))) return false;
  }

  // R-14: nivå Ny i löpning får aldrig löppass två dagar i rad.
  if (
    rules.runVolume.noBackToBackForNewLevel &&
    session.sport === 'run' &&
    input.levels.run === 'new'
  ) {
    const ärLöpning = (kandidat: PendingSession) => kandidat.sport === 'run';
    const löpdag = (datum: IsoDate) =>
      before.runDates.has(datum) || dayHas(datum, perDag, ärLöpning);

    if (löpdag(addDays(date, -1)) || löpdag(addDays(date, 1))) return false;
  }

  return true;
}

function isHard(session: PendingSession): boolean {
  return session.zone !== null && session.zone >= 3;
}

function dayHas(
  date: IsoDate,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
  predikat: (session: PendingSession) => boolean,
): boolean {
  return (perDag.get(date) ?? []).some(predikat);
}

function minutesOn(
  date: IsoDate,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
): number {
  return (perDag.get(date) ?? []).reduce((summa, session) => summa + session.minutes, 0);
}

/**
 * Dagarnas pass som färdiga `Session`-objekt, plus vilodagar.
 *
 * Varje dag utan pass blir ett uttalat vilopass. Vilan är en del av programmet
 * och ska stå i planen, inte vara ett hål i den.
 */
function toSessions(
  week: WeekSkeleton,
  dates: readonly IsoDate[],
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
): Session[] {
  const resultat: Session[] = [];

  for (const [dagIndex, datum] of dates.entries()) {
    const dagens = perDag.get(datum) ?? [];

    if (dagens.length === 0) {
      resultat.push({
        id: `w${String(week.index).padStart(2, '0')}-d${dagIndex + 1}-1`,
        date: datum,
        sport: null,
        type: 'rest',
        minutes: 0,
        zone: null,
        title: '',
        instruction: '',
      });
      continue;
    }

    // Längsta passet först på dagen, så att dagens tyngd syns direkt.
    const ordnade = [...dagens].sort((a, b) => b.minutes - a.minutes);

    for (const [i, session] of ordnade.entries()) {
      const färdigt: Session = {
        id: `w${String(week.index).padStart(2, '0')}-d${dagIndex + 1}-${i + 1}`,
        date: datum,
        sport: session.sport,
        type: session.type,
        minutes: session.minutes,
        zone: session.zone,
        title: '',
        instruction: '',
      };

      // R-27: loppets id sätts bara på lopppass, så att en andra tävling samma
      // vecka går att känna igen utan att leta i titeln.
      const raceId = session.raceId;
      resultat.push(raceId === undefined ? färdigt : { ...färdigt, raceId });
    }
  }

  return resultat;
}

/**
 * Titel och instruktion från `config/sessions.json` (R-30).
 *
 * Sportspecifika varianter går före den allmänna texten: simteknik beskrivs
 * inte som skidteknik. Saknas en kombination är det ett fel i konfigurationen
 * och ska märkas som ett kastat undantag, inte som ett tomt fält.
 */
function withTitleAndInstruction(session: Session, week: WeekSkeleton, index: number): Session {
  const variant =
    session.sport === null ? undefined : sessionTexts.sportVariants[`${session.sport}.${session.type}`];
  const allmän = sessionTexts.types[session.type];

  const text = variant ?? allmän;
  if (text === undefined) {
    throw new Error(
      `config/sessions.json saknar text för passtypen "${session.type}"` +
        ` (vecka ${week.index}, pass ${index + 1})`,
    );
  }

  return { ...session, title: text.title, instruction: text.instruction };
}
