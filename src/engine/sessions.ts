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
import { isDeferred, newLevelLimit, weekBudgets, type WeekBudget } from './budget.ts';
import { withVolumeEncouragement } from './volume.ts';
import { raceById, rules, sessions as sessionTexts } from './config.ts';
import { addDays, monthOf, weekdayOf } from './dates.ts';
import type {
  IsoDate,
  Level,
  Phase,
  PlanInput,
  PreferredDays,
  RaceId,
  SessionAlternative,
  Session,
  SessionType,
  TrainedSport,
  Zone,
} from './types.ts';
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

  // R-48: sist läggs uppmuntran på långpassen i de grenar där planen inte når
  // sitt volymriktmärke. Den behöver hela planen för att räknas ut, så den
  // kommer efter att veckorna är byggda — inte inne i dem.
  return withVolumeEncouragement(resultat, input);
}

/**
 * Det föregående veckan behöver skicka vidare.
 *
 * R-14 och R-16 handlar båda om dagar i rad, och veckogränsen är inte något
 * reglerna känner av. Utan det här kunde söndag och måndag båda bli hårda.
 */
interface CarriedOver {
  hardDates: ReadonlySet<IsoDate>;
  /** Dagar som bar ett hårt pass eller långpasset (R-43). */
  loadDates: ReadonlySet<IsoDate>;
  runDates: ReadonlySet<IsoDate>;
}

const INGET_FÖRE: CarriedOver = {
  hardDates: new Set(),
  loadDates: new Set(),
  runDates: new Set(),
};

/**
 * Dagar som bär veckans belastning (R-43).
 *
 * Ett hårt pass är belastning, och långpasset är det också. Lärdomen från
 * tränargranskningen är att tre tunga dagar i en vecka tömmer depåerna även
 * när de ligger utspridda i kalendern — det räcker inte att de inte ligger i
 * rad.
 */
function isLoadDay(session: { zone: number | null; type: SessionType }): boolean {
  if (session.type === 'race' || session.type === 'long') return session.type === 'long';
  return session.zone !== null && session.zone >= 3;
}

function carryOver(plan: WeekPlan): CarriedOver {
  return {
    hardDates: new Set(
      plan.sessions
        .filter((session) => session.zone !== null && session.zone >= 3)
        .map((session) => session.date),
    ),
    loadDates: new Set(
      plan.sessions
        .filter((session) => isLoadDay(session))
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
  const long = longSession(
    week,
    budget,
    dates,
    raceDates,
    openerDates,
    allWeeks,
    input.preferredDays,
    input,
    races,
    platser,
  );
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

/**
 * Veckans långpass i loppets sport (R-13, R-28).
 *
 * Passet finns i både bas- och specifik fas, och ligger på den dag användaren
 * valt. Det växer jämnt genom sin fas, och den specifika fasen tar vid där
 * basen slutade: basen går från en fjärdedel till hälften av grenens tak, den
 * specifika fasen från hälften till taket. Grundperioden är där uthålligheten
 * byggs, och ett kvartal utan ett enda längre pass är svårt att försvara.
 *
 * Tre tak gäller samtidigt — grenens tak i R-13, 70 procent av veckans tid i
 * R-28, och den tid grenen faktiskt har fått i veckan.
 *
 * Blir resultatet kortare än `longSession.minMinutes` är det inget långpass,
 * och veckan får i stället vanliga konditionspass.
 */
/**
 * Tid veckan måste lämna kvar till en gren som har ett pass varje vecka (R-31).
 *
 * Är man ny i en gren ligger kursen på samma tid varje vecka, och tekniken
 * går inte att komma ikapp på slutet. Långpasset får därför inte ta så stor
 * del av veckan att den grenens pass inte går att lägga — och med golvet i
 * R-40 är simningens pass en hel timme.
 */
/**
 * Grenar som ska tränas varje vecka, vad veckans andelar än säger.
 *
 * Två fall: man är ny i grenen och går en kurs som ligger på samma tid varje
 * vecka (R-31), eller grenens lopp är på väg och grenen har ett golv som
 * veckans andel sällan når upp till (R-40). Utan det andra fallet föll
 * simningen bort vecka efter vecka i en plan på tre timmar — andelen blev
 * tjugo minuter, och tjugo minuter är inget simpass. En gren som aldrig
 * tränas är precis det som gick fel i v0, och simning går inte att komma
 * ikapp de sista veckorna.
 */
function hasWeeklyRequirement(
  sport: TrainedSport,
  week: WeekSkeleton,
  input: PlanInput,
  races: readonly PlacedRace[],
): boolean {
  if (newLevelLimit(sport, input) !== null) return true;
  if (sessionFloor(sport) === rules.session.minMinutes) return false;

  const lopp = races.find((kandidat) => raceById(kandidat.id).sport === sport);
  if (lopp === undefined || lopp.date < week.startDate) return false;

  return !isDeferred(sport, week, input, races);
}

function reservedForRequiredSports(
  except: TrainedSport,
  week: WeekSkeleton,
  budget: WeekBudget,
  input: PlanInput,
  races: readonly PlacedRace[],
): number {
  let reserv = 0;

  for (const [gren, minuter] of Object.entries(budget.bySport) as [TrainedSport, number][]) {
    if (gren === except || minuter <= 0) continue;
    if (!hasWeeklyRequirement(gren, week, input, races)) continue;
    reserv += sessionFloor(gren);
  }

  return reserv;
}

function longSession(
  week: WeekSkeleton,
  budget: WeekBudget,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  allWeeks: readonly WeekSkeleton[],
  preferredDays: PreferredDays,
  input: PlanInput,
  races: readonly PlacedRace[],
  slots: number,
): PendingSession | null {
  const kurva = week.phase === 'base' || week.phase === 'specific'
    ? rules.longSession.growthByPhase[week.phase]
    : undefined;
  if (kurva === undefined || week.focusRaceId === null) return null;

  const sport = raceById(week.focusRaceId).sport as TrainedSport;
  const tillgängligt = budget.bySport[sport] ?? 0;
  if (tillgängligt === 0) return null;

  const cap = rules.longSession.capMinutesBySport[sport];
  const { maxShareOfWeek } = rules.longSession;
  const { startShareOfCap, endShareOfCap } = kurva;

  // Långpasset ska vara veckans längsta pass. Med en plats per dag (R-42) är
  // veckans tid delad på platserna vad ett vanligt pass blir, och ett
  // långpass kortare än det är precis felet från v0: där låg långpasset sist
  // i kön och blev alltid för kort.
  const snitt = slots <= 0 ? 0 : Math.ceil(budget.enduranceMinutes / slots);

  // Hur långt genom fasen veckan ligger: 1/n i första veckan, 1 i den sista.
  const iFasen = allWeeks.filter((kandidat) => kandidat.phaseId === week.phaseId);
  const position = iFasen.findIndex((kandidat) => kandidat.index === week.index) + 1;
  const andelGenomFasen = position / iFasen.length;

  // Långpasset trappas upp varje vecka genom fasen (R-13, R-46). Kurvan går
  // från sin startandel till sin slutandel — men aldrig under veckans snitt,
  // eftersom långpasset ska vara veckans längsta pass (R-42).
  //
  // Snittet är **startpunkten**, inte ett golv under kurvan. Som golv blev
  // kurvan platt tills den hann upp och hoppade sedan: långpasset mot
  // Lidingöloppet låg på 75 minuter fyra veckor i rad och gick därefter till
  // 122 på en vecka. Det är sextiotre procent, och en sådan ökning är precis
  // vad en upptrappning finns för att undvika.
  const start = Math.max(cap * startShareOfCap, snitt);
  const slut = Math.max(cap * endShareOfCap, start);
  const växande = start + (slut - start) * andelGenomFasen;

  // R-13: de sista veckorna före loppet får långpasset låna tid från de andra
  // grenarna, upp till taket i R-28. Annars binds det av grenens andel i R-08
  // och hinner aldrig bli långt nog — ett långpass på tre timmar inför 315
  // kilometer på cykel är inte en förberedelse, det är en gissning.
  // R-46: lånet följer kurvan hela fasen, inte bara de sista veckorna.
  //
  // Förut slogs det på som en knapp fyra veckor före loppet. Dessförinnan var
  // långpasset bundet av grenens egen andel i R-08 — mot Lidingöloppet låg det
  // på 75 minuter fyra veckor i rad — och när lånet slogs på hoppade det till
  // 122. Sextiotre procent på en vecka är precis vad en upptrappning finns för
  // att undvika, och löpning är den gren som sliter mest.
  //
  // Taket på 70 procent av veckan (R-28) och grenens eget tak (R-13) gäller
  // fortfarande, och de lånade minuterna tas från de övriga grenarna i
  // proportion till deras tid, så veckans totala tid är oförändrad (R-29).
  void tillgängligt;
  const grenensTid = budget.enduranceMinutes;

  // R-40: ett långpass är inget undantag från grenens golv. Ett simpass på
  // femtio minuter är lika mycket besvär att ta sig till som ett på sextio.
  //
  // Golvet gäller dessutom alla grenar veckan tränar, inte bara långpassets
  // egen: långpasset är veckans längsta pass (R-42), så ett långpass på femtio
  // minuter skulle klippa veckans simpass till femtio. Ryms inte det högsta
  // golvet blir det inget långpass, och då är inget pass bundet av det.
  const golvIVeckan = (Object.entries(budget.bySport) as [TrainedSport, number][])
    .filter(([, minuter]) => minuter > 0)
    .map(([gren]) => sessionFloor(gren));

  const golv = Math.max(
    rules.longSession.minMinutes,
    sessionFloor(sport),
    ...golvIVeckan,
  );

  // R-31: det som måste lämnas kvar till en nybörjargren dras av — men aldrig
  // så att långpasset faller under sitt eget golv. Räcker veckan inte till
  // båda behåller långpasset sin tid.
  const reserv = reservedForRequiredSports(sport, week, budget, input, races);
  const utrymme = Math.max(budget.enduranceMinutes - reserv, golv);

  const minuter = Math.min(
    Math.round(växande),
    cap,
    Math.floor(budget.enduranceMinutes * maxShareOfWeek),
    grenensTid,
    rules.session.maxMinutes,
    utrymme,
  );

  if (minuter < golv) return null;

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

  // Är veckan avkortad (R-01) har den valda dagen passerat, inte blivit
  // upptagen. Då blir det inget långpass: reservdagen är veckans sista, och
  // ligger nästa veckas långpass på en måndag hamnar två långpass intill
  // varandra — vilket bryter mot R-43. Upptrappningen börjar i vecka 2.
  if (dates.length < 7) return null;

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
  races: readonly PlacedRace[],
  slots: number,
  fullWeek: boolean,
): PendingSession[] {
  if (slots <= 0) return [];

  const kvarPerSport = remainingBySport(budget, long);

  // R-31: taket per vecka gäller också när färre pass delar på samma tid.
  // Långpassets minuter räknas in i grenens vecka och dras av här.
  const takPerSport = new Map<TrainedSport, number>();
  for (const [sport] of kvarPerSport) {
    const gräns = newLevelLimit(sport, input);
    if (gräns === null) continue;

    const iLångpasset = long !== null && long.sport === sport ? long.minutes : 0;
    takPerSport.set(sport, Math.max(0, gräns.maxMinutesPerWeek - iLångpasset));
  }

  // R-42: kvalitetspasset ligger i veckans fokusgren. Grenen behöver då en
  // plats till det passet utöver teknikpasset (R-21) — har den bara en, och
  // den går till tekniken, finns inget hårt pass kvar att lägga.
  const fokusgren = focusSportOf(week);
  const fokusBehov = fokusgren === null ? 0 : focusSlotsNeeded(fokusgren, week, input);

  // Fokusgrenens extra platser tas från de övriga grenarna, inte från luften.
  const maxSporter = Math.max(1, slots - Math.max(0, fokusBehov - 1));

  const fördelat = foldAwayTooSmallSports(
    kvarPerSport,
    week,
    input,
    races,
    maxSporter,
    takPerSport,
  );
  // Platserna delas ut: varje gren som kom med får en, och det som blir över
  // går till grenarna med mest tid. Så blir det aldrig fler pass än dagar.
  const platsPerSport = shareSlots(fördelat, slots, fokusgren, fokusBehov);

  // Kvalitetspasset läggs bara om fokusgrenen faktiskt har en plats kvar till
  // det när teknikpasset tagit sin. Räcker veckan inte till båda går tekniken
  // före — den går inte att komma ikapp på slutet (R-21).
  const fokusHarPlats =
    fokusgren !== null && (platsPerSport.get(fokusgren) ?? 0) >= fokusBehov && fokusBehov > 0;

  // En avkortad första vecka (R-01) får inget hårt pass. Placeringen ser bara
  // bakåt, inte framåt, så ett hårt pass på stubbveckans sista dagar hamnade
  // intill nästa veckas långpass och bröt mot R-43. Kvalitetsarbetet börjar i
  // vecka 2, precis som långpasset.
  const hårda =
    fokusHarPlats && fullWeek
      ? hardSessionPlan(week, input, fokusgren as TrainedSport)
      : new Map<TrainedSport, HardSession[]>();

  const resultat: PendingSession[] = [];

  for (const [sport, minuter] of fördelat) {
    // Långpasset ska vara veckans längsta pass. Har sporten ett långpass får
    // dess övriga pass därför inte bli längre än det — annars blir "långpasset"
    // kortast av allt, vilket är precis felet från v0.
    // Långpasset är veckans längsta pass — i sin egen gren och i alla andra.
    const tak = long !== null ? long.minutes : rules.session.maxMinutes;

    // R-31: är man ny i sporten får veckan bara så många pass som taket säger.
    // En nybörjarkurs i simning är ett pass i veckan, inte två korta.
    //
    // Långpasset är redan lagt och räknas med. Är taket ett pass i veckan är
    // långpasset alltså veckans enda pass i sporten.
    const gräns = newLevelLimit(sport, input);
    const redanLagt = long !== null && long.sport === sport ? 1 : 0;
    const flestPass = Math.min(
      (gräns?.maxSessionsPerWeek ?? Number.POSITIVE_INFINITY) - redanLagt,
      platsPerSport.get(sport) ?? 0,
    );
    if (flestPass <= 0) continue;

    // R-21: ett av veckans pass i en nybörjargren blir teknikpass. Det tas
    // före de hårda passen — tekniken är det som avgör, inte intensiteten.
    let teknikKvar = needsTechnique(sport, week.phase, input)
      ? rules.technique.sessionsPerWeek
      : 0;

    for (const längd of splitIntoSessions(minuter, tak, flestPass, sport)) {
      if (teknikKvar > 0) {
        teknikKvar -= 1;
        resultat.push({ sport, type: 'technique', minutes: längd, zone: 2 });
        continue;
      }

      const hård = hårda.get(sport)?.pop();
      resultat.push({
        sport,
        type: hård?.type ?? defaultTypeFor(sport, week.phase),
        minutes: längd,
        zone: hård?.zone ?? 2,
      });
    }
  }

  return distributeLeftover(
    capHardSessions(resultat, week.phase),
    budget,
    long,
    input,
    week.phase,
  );
}

/**
 * Fasens tak på hård tid (R-15), eller null när fasen inte har något.
 *
 * Bara nedtrappningen har ett tak. R-15 säger "korta inslag i zon 3" om just
 * den fasen, och utan en siffra blev det ett helt tröskelpass på upp till två
 * timmar veckan före loppet.
 */
function maxHardMinutes(phase: Phase): number | null {
  const fas = rules.intensity.byPhase[phase];
  return 'maxHardMinutes' in fas ? fas.maxHardMinutes : null;
}

/**
 * Hårda pass kapade till fasens tak (R-15).
 *
 * Minuterna som kapas bort försvinner inte — de fördelas på veckans övriga
 * pass av `distributeLeftover` (R-29). Veckans tid är alltså oförändrad, men
 * den ligger i zon 1–2 i stället för i zon 3.
 */
function capHardSessions(
  sessions: readonly PendingSession[],
  phase: Phase,
): PendingSession[] {
  const tak = maxHardMinutes(phase);
  if (tak === null) return [...sessions];

  return sessions.map((session) => {
    if (!isHard(session) || session.minutes <= tak) return { ...session };

    // R-40 går före R-15 i en gren med eget golv. Taket på hårda minuter är
    // till för att nedtrappningen ska vara en nedtrappning, men ett simpass
    // som skärs ner till tjugo minuter är en resa till simhallen för tjugo
    // minuters träning. Passet behåller sin längd och görs lugnt i stället —
    // veckan blir inte hårdare av det, vilket är hela poängen med taket.
    if (session.sport !== 'strength' && sessionFloor(session.sport) > tak) {
      return { ...session, type: defaultTypeFor(session.sport, phase), zone: 2 as const };
    }

    return { ...session, minutes: tak };
  });
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
  input: PlanInput,
  fas: Phase,
): PendingSession[] {
  const resultat = endurance.map((session) => ({ ...session }));

  const planerat =
    resultat.reduce((summa, session) => summa + session.minutes, 0) + (long?.minutes ?? 0);
  let kvar = budget.enduranceMinutes - budget.unplacedMinutes - planerat;
  if (kvar <= 0 || resultat.length === 0) return resultat;

  // En minut i taget på det kortaste passet som får växa. Enkelt och alltid
  // samma resultat för samma indata.
  // R-31: ett pass i en sport man är ny i får inte växa förbi sitt veckotak.
  const taketFör = (session: PendingSession): number => {
    // R-15: ett hårt pass får inte växa tillbaka förbi fasens tak.
    const hårt = isHard(session) ? (maxHardMinutes(fas) ?? Infinity) : Infinity;
    if (session.sport === 'strength') return Math.min(rules.session.maxMinutes, hårt);

    // R-42: inget pass växer förbi långpasset — det är veckans längsta.
    const längsta = long === null || session === long ? Infinity : long.minutes;

    // R-40: ett pass växer aldrig förbi sin egen grens tak.
    const gräns = newLevelLimit(session.sport, input);
    return Math.min(
      sessionCeiling(session.sport),
      gräns?.maxMinutesPerWeek ?? Infinity,
      hårt,
      längsta,
    );
  };

  while (kvar > 0) {
    const kanVäxa = resultat.filter((session) => session.minutes < taketFör(session));
    if (kanVäxa.length === 0) break;

    const kortast = kanVäxa.reduce((a, b) => (b.minutes < a.minutes ? b : a));
    kortast.minutes += 1;
    kvar -= 1;
  }

  return resultat;
}

/**
 * Passtypen när veckan inte har något hårt pass att ge sporten (R-33).
 *
 * Under återhämtningen blir pass i en teknikgren teknikpass. Kroppen ska få
 * vila efter ett långt lopp, men tekniken tappas fort — särskilt i simning,
 * där det inte hjälper att ha cyklat. Ett teknikpass håller den uppe utan att
 * belasta.
 */
function defaultTypeFor(sport: TrainedSport, phase: Phase): SessionType {
  if (phase !== 'recovery') return 'easy';

  const teknikgrenar: readonly string[] = rules.recovery.techniqueSports;
  return teknikgrenar.includes(sport) ? 'technique' : 'easy';
}

/**
 * Sant när grenen ska ha ett teknikpass den här veckan (R-21).
 *
 * Är man ny i skidor eller simning avgörs loppet av tekniken, inte av
 * konditionen. Ett teknikpass per vecka under bas- och specifik fas — i
 * nedtrappning och återhämtning styr R-33 i stället.
 */
function needsTechnique(sport: TrainedSport, phase: Phase, input: PlanInput): boolean {
  if (phase !== 'base' && phase !== 'specific') return false;

  const grenar: readonly string[] = rules.technique.sportsForNewLevel;
  return grenar.includes(sport) && input.levels[sport] === 'new';
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

  // Lånade långpasset mer än sin gren hade får de andra grenarna betala, i
  // proportion till sin tid. Veckans totala tid är oförändrad.
  if (long === null) return kvar;
  const lånande = long.sport as TrainedSport;

  const lån = -Math.min(0, kvar.get(lånande) ?? 0);
  if (lån === 0) return kvar;

  kvar.set(lånande, 0);

  const övriga = [...kvar.entries()].filter(([sport]) => sport !== lånande);
  const övrigTid = övriga.reduce((summa, [, minuter]) => summa + minuter, 0);
  if (övrigTid <= 0) return kvar;

  let kvarAttTa = Math.min(lån, övrigTid);
  for (const [sport, minuter] of övriga) {
    const andel = Math.round((lån * minuter) / övrigTid);
    const tas = Math.min(andel, minuter, kvarAttTa);
    kvar.set(sport, minuter - tas);
    kvarAttTa -= tas;
  }

  // Avrundningsrest: ta den från den gren som har mest kvar.
  while (kvarAttTa > 0) {
    const störst = [...kvar.entries()]
      .filter(([sport, minuter]) => sport !== lånande && minuter > 0)
      .sort((a, b) => b[1] - a[1])[0];
    if (störst === undefined) break;

    kvar.set(störst[0], störst[1] - 1);
    kvarAttTa -= 1;
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
/** Veckans fokusgren, eller null när veckan inte har något fokuslopp. */
function focusSportOf(week: WeekSkeleton): TrainedSport | null {
  if (week.focusRaceId === null) return null;
  return raceById(week.focusRaceId).sport as TrainedSport;
}

/**
 * Platser fokusgrenen behöver (R-21, R-42).
 *
 * En för kvalitetspasset, och en till om grenen också ska ha ett teknikpass.
 * Noll när fasen inte har något hårt pass — då behöver fokusgrenen inget
 * särskilt och delar platser med de övriga.
 */
function focusSlotsNeeded(sport: TrainedSport, week: WeekSkeleton, input: PlanInput): number {
  if (rules.intensity.byPhase[week.phase].hardSessionsPerWeek === 0) return 0;

  // Krockar grenens golv med fasens tak på hårda minuter finns inget hårt
  // pass att lägga, och då behövs ingen extra plats.
  const tak = maxHardMinutes(week.phase);
  if (tak !== null && sessionFloor(sport) > tak) return 0;

  const teknik = needsTechnique(sport, week.phase, input) ? rules.technique.sessionsPerWeek : 0;
  return teknik + 1;
}

/**
 * Veckans platser fördelade på grenarna (R-42).
 *
 * En dag bär ett pass, så antalet platser är antalet dagar som är kvar. Varje
 * gren som kom med får en plats — annars hade den inte kommit med — och de
 * platser som blir över går till grenarna med mest tid. Vid lika tid avgör
 * namnet, så att samma indata alltid ger samma plan.
 */
function shareSlots(
  bySport: readonly [TrainedSport, number][],
  slots: number,
  focus: TrainedSport | null,
  focusNeeds: number,
): Map<TrainedSport, number> {
  const resultat = new Map<TrainedSport, number>(bySport.map(([sport]) => [sport, 1]));

  // Fokusgrenen får sitt behov först: en plats till teknikpasset om grenen
  // kräver det, och en till kvalitetspasset. Veckan handlar om den grenen.
  // Behovet får aldrig överskrida de platser veckan faktiskt har. I en
  // avkortad första vecka (R-01) kan en enda plats finnas, och då staplades
  // teknikpasset och kvalitetspasset på samma dag.
  const iPlanen = focus !== null && resultat.has(focus);
  if (iPlanen && focusNeeds > 1) {
    resultat.set(focus as TrainedSport, Math.max(1, Math.min(focusNeeds, slots)));
  }

  const taget = [...resultat.values()].reduce((a, b) => a + b, 0);
  let kvar = slots - taget;
  const ordnade = [...bySport].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Varv efter varv, så att den största grenen inte tar alla platser på en gång.
  while (kvar > 0) {
    let delatUt = 0;

    for (const [sport] of ordnade) {
      if (kvar <= 0) break;
      resultat.set(sport, (resultat.get(sport) as number) + 1);
      kvar -= 1;
      delatUt += 1;
    }

    if (delatUt === 0) break;
  }

  return resultat;
}

/**
 * Kortaste pass som är värt att göra i en gren (R-40).
 *
 * De flesta grenar har bara träningstiden att betala. Simningen har mer: man
 * ska ta sig till simhallen, betala inträde och byta om, och det är lika
 * mycket besvär för tjugo minuter i vattnet som för en timme. Ett sådant pass
 * har ett högre golv, och räcker veckans tid inte till simmar man inte den
 * veckan.
 */
function sessionFloor(sport: TrainedSport): number {
  const perGren: Partial<Record<TrainedSport, number>> = rules.session.minMinutesBySport;
  return perGren[sport] ?? rules.session.minMinutes;
}

/**
 * Längsta pass som blir av i en gren (R-40).
 *
 * Simning har ett tak de andra grenarna inte har: nittio minuter är ett långt
 * pass i bassäng, och tiden utöver det gör mer nytta i en annan gren än som
 * ytterligare längder. Får grenen mer tid än den rymmer flyttas överskottet
 * (R-29) — det försvinner inte.
 */
function sessionCeiling(sport: TrainedSport): number {
  const perGren: Partial<Record<TrainedSport, number>> = rules.session.maxMinutesBySport;
  return perGren[sport] ?? rules.session.maxMinutes;
}

function foldAwayTooSmallSports(
  bySport: ReadonlyMap<TrainedSport, number>,
  week: WeekSkeleton,
  input: PlanInput,
  races: readonly PlacedRace[],
  maxSports: number,
  maxBySport: ReadonlyMap<TrainedSport, number>,
): [TrainedSport, number][] {
  const alla = [...bySport.entries()].filter(([, minuter]) => minuter > 0);
  if (alla.length === 0) return [];

  const totalt = alla.reduce((summa, [, minuter]) => summa + minuter, 0);

  // Veckans fokusgren står alltid först och väljs alltid — men bara om veckans
  // tid räcker till ett helt pass i den. Gör den inte det får rotationen
  // avgöra ensam.
  const fokus =
    week.focusRaceId === null ? null : (raceById(week.focusRaceId).sport as TrainedSport);
  const fokusRad = alla.find(([sport]) => sport === fokus);
  const fokusValbar = fokusRad !== undefined && totalt >= sessionFloor(fokusRad[0]);

  // Rotationen avgör vilka av de övriga som kommer med, och den bygger på
  // veckonumret. Urvalet får inte styras av hur mycket tid grenen har: då
  // faller samma gren bort varje vecka, och en gren som aldrig tränas är
  // precis det som gick fel i v0. Simningen har minst tid och skulle alltid
  // vara den som ströks.
  const övriga = alla.filter(([sport]) => !(fokusValbar && sport === fokus));
  const start = övriga.length === 0 ? 0 : (week.index - 1) % övriga.length;
  const roterade = [...övriga.slice(start), ...övriga.slice(0, start)];

  // En gren som ska tränas varje vecka får inte kunna roteras bort, och med
  // ett högre golv (R-40) skulle den annars falla bort de veckor där
  // långpasset tagit sin del först.
  const måste = ([sport]: [TrainedSport, number]): boolean =>
    hasWeeklyRequirement(sport, week, input, races);
  const kön = roterade;

  // Varje vald gren fylls upp till ett helt pass i just den grenen. En
  // proportionell fördelning håller annars den minsta grenen liten för alltid:
  // simningen i en plan på tre timmar i veckan skulle få elva minuter, alltså
  // inget pass, hur många veckor som än gick.
  const valda: { sport: TrainedSport; minutes: number; share: number }[] = [];
  let kvar = totalt;

  const välj = (rad: [TrainedSport, number]): void => {
    const [sport, minuter] = rad;
    const golv = sessionFloor(sport);
    if (kvar < golv) return;

    // R-42: fler grenar än veckan har dagar går inte att lägga ut.
    if (valda.length >= maxSports) return;

    // R-31: taket per vecka går före golvet. Ryms inget helt pass under taket
    // tränas grenen inte den veckan.
    const tak = maxBySport.get(sport) ?? Number.POSITIVE_INFINITY;
    if (tak < golv) return;

    const tid = Math.min(Math.max(minuter, golv), kvar, tak);
    valda.push({ sport, minutes: tid, share: minuter });
    kvar -= tid;
  };

  // Grenar som ska tränas varje vecka går först — före fokusgrenen. Fokus har
  // redan veckans största andel och i de flesta veckor långpasset; det som är
  // kvar av den efter långpasset är smulor, och smulor ska inte kunna knuffa
  // bort en hel timme i en gren som annars inte blir tränad alls.
  const [måsteKö, övrigKö] = [kön.filter(måste), kön.filter((rad) => !måste(rad))];

  for (const rad of måsteKö) välj(rad);
  if (fokusValbar && fokusRad !== undefined) välj(fokusRad);
  for (const rad of övrigKö) välj(rad);

  if (valda.length === 0) return [];

  const resultat: [TrainedSport, number][] = valda.map((rad) => [rad.sport, rad.minutes]);

  // Det som är kvar fördelas i proportion till grenarnas ursprungliga tid, så
  // att veckans fokus ligger kvar där det ska.
  const över = totalt - valda.reduce((summa, rad) => summa + rad.minutes, 0);

  if (över > 0) {
    const andelar = valda.reduce((summa, rad) => summa + rad.share, 0);
    if (andelar > 0) {
      for (const [i, rad] of valda.entries()) {
        const utrad = resultat[i] as [TrainedSport, number];
        const tak = maxBySport.get(rad.sport) ?? Number.POSITIVE_INFINITY;
        utrad[1] = Math.min(utrad[1] + Math.floor((över * rad.share) / andelar), tak);
      }
    }
  }

  // Avrundningsresten läggs på den gren som har mest tid, så inget tappas.
  const summa = resultat.reduce((a, [, minuter]) => a + minuter, 0);
  const rest = totalt - summa;

  if (rest > 0) {
    // Resten går till den största grenen som har utrymme under sitt tak.
    const ordnade = [...resultat].sort((a, b) => b[1] - a[1]);
    const mottagare = ordnade.find(
      ([sport, minuter]) => minuter + rest <= (maxBySport.get(sport) ?? Number.POSITIVE_INFINITY),
    );
    if (mottagare !== undefined) mottagare[1] += rest;
  }

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
function splitIntoSessions(
  minutes: number,
  maxLength: number,
  maxSessions: number,
  sport: TrainedSport,
): number[] {
  const golv = sessionFloor(sport);
  if (minutes < golv) return [];

  const taket = Math.min(maxLength, sessionCeiling(sport));

  // Grenen använder de platser den fått, så länge varje pass håller golvet.
  // Att föreslå två långa pass när veckan har sex dagar ger ett pass på fem
  // timmar och fyra vilodagar — det hände i nedtrappningen före Vasaloppet,
  // när R-45 gav skidorna hela veckan.
  const flest = Math.min(Math.floor(minutes / golv), maxSessions);
  const antal = Math.max(1, flest);

  const grund = Math.floor(minutes / antal);
  const rest = minutes - grund * antal;
  const pass = Array.from({ length: antal }, (_, i) => grund + (i < rest ? 1 : 0));

  // Golvet och taket går inte alltid att hålla samtidigt: 106 minuter simning
  // blir antingen ett pass på 106 eller två på 53, och båda bryter en regel.
  // Då gäller taket, och de minuter som blir över går till en annan gren
  // (R-29) i stället för att bli längder ingen orkar simma.
  return pass.map((längd) => Math.min(längd, taket));
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
function hardSessionPlan(
  week: WeekSkeleton,
  input: PlanInput,
  sport: TrainedSport,
): Map<TrainedSport, HardSession[]> {
  const plan = new Map<TrainedSport, HardSession[]>();
  const fas = rules.intensity.byPhase[week.phase];
  if (fas.hardSessionsPerWeek === 0) return plan;

  // Utan fokuslopp finns ingen sport som veckan handlar om, och därmed inget
  // pass som ska vara hårt.
  if (week.focusRaceId === null) return plan;
  // R-15 och R-40 kan krocka: i nedtrappningen får ett hårt pass vara högst
  // tjugo minuter, och ett simpass är aldrig kortare än sextio. Då finns inget
  // hårt pass att lägga i den grenen, och veckan får inget — kvalitetspasset
  // ligger i fokusgrenen eller ingen alls.
  const tak = maxHardMinutes(week.phase);
  if (tak !== null && sessionFloor(sport) > tak) return plan;

  const maxZone = maxZoneFor(week.phase, input.levels[sport]);
  const hårda: HardSession[] = [];

  // Intervallpasset först där zonen tillåter det: räcker veckan till ett enda
  // hårt pass ska det vara intervallerna — en dag i veckan ska vara
  // intervaller (R-42). Tröskelpasset i zon 3 är det hårda passet i
  // grundperioden, där zon 4 inte hör hemma än.
  if (maxZone >= 4) hårda.push({ type: 'intervals', zone: 4 });
  if (maxZone >= 3) hårda.push({ type: 'tempo', zone: 3 });

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
  const övriga = inConstraintOrder(pending.filter((session) => session.fixedDate === undefined));

  for (const session of övriga) {
    const dag = bestDateFor(session, lediga, perDag, input, before);

    // Saknar veckan dagar helt går passet inte att lägga. Det hände i en
    // avkortad första vecka, och resultatet var en krasch i stället för en
    // plan — det värsta möjliga utfallet (fynd F-1).
    const dagens = dag === null ? undefined : perDag.get(dag);
    if (dagens === undefined) continue;

    dagens.push(session);
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
 * Passen i den ordning de ska få välja dag.
 *
 * Det hårt bundna passet väljer först. Ett hårt pass ska ha två lugna dagar
 * efter sig (R-43) och styrkan vill ha en egen dag (R-42), så de har bara
 * någon enstaka dag att välja mellan — medan ett lugnt pass passar nästan var
 * som helst. Får de lugna passen välja först tar de dagen det hårda behövde,
 * och då finns ingen tillåten dag kvar och regeln bryts.
 *
 * Ordningen inom varje grupp är oförändrad, så samma indata ger samma plan.
 */
function inConstraintOrder(pending: readonly PendingSession[]): PendingSession[] {
  const ordning = (session: PendingSession): number => {
    if (isLoadDay(session)) return 0;
    if (session.sport === 'strength') return 1;
    return 2;
  };

  return [...pending]
    .map((session, i) => ({ session, i }))
    .sort((a, b) => ordning(a.session) - ordning(b.session) || a.i - b.i)
    .map(({ session }) => session);
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
): IsoDate | null {
  const tillåtna = dates.filter((datum) =>
    allowedOn(session, datum, perDag, input, before),
  );
  const urval = tillåtna.length > 0 ? tillåtna : dates;
  if (urval.length === 0) return null;

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

  // R-42: styrkepasset ligger ensamt på sin dag. Ett styrkepass på tjugo
  // minuter ovanpå två löppass är inget styrkepass — och en hel timme styrka
  // förtjänar en dag.
  if (rules.strength.ownDay) {
    const ärStyrka = (kandidat: PendingSession) => kandidat.sport === 'strength';
    const dagensPass = perDag.get(date) ?? [];

    if (session.sport === 'strength' && dagensPass.length > 0) return false;
    if (session.sport !== 'strength' && dayHas(date, perDag, ärStyrka)) return false;
  }

  // R-42: ett konditionspass per dag. Appen är byggd för folk med jobb, och
  // två pass samma dag förutsätter att man kan träna två gånger.
  if (session.sport !== 'strength' && (perDag.get(date) ?? []).length > 0) return false;

  // R-43: efter ett hårt pass följer två dagar som varken bär ett hårt pass
  // eller långpasset.
  const lugnaDagar = rules.intensity.minEasyDaysAfterHard;
  if (lugnaDagar > 0 && isLoadDay(session)) {
    const belastad = (datum: IsoDate) =>
      before.loadDates.has(datum) || dayHas(datum, perDag, isLoadDay);

    if (belastad(date)) return false;
    for (let steg = 1; steg <= lugnaDagar; steg += 1) {
      if (belastad(addDays(date, -steg)) || belastad(addDays(date, steg))) return false;
    }
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
        alternatives: [],
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
        alternatives: [],
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
 * Den text som ligger närmast passet, eller undefined för den allmänna (R-30).
 *
 * Styrkan viktas mot veckans fokuslopp där grenen kräver det: inför Vasaloppet
 * mot överkropp och bål, eftersom stakningen kommer därifrån (R-10).
 *
 * Grenspecifika varianter går före den allmänna texten. Simteknik beskrivs
 * inte som skidteknik, och ett långpass i terräng inte som ett på asfalt.
 */
function textVariantFor(
  session: Session,
  week: WeekSkeleton,
): { title: string; instruction: string } | undefined {
  if (session.type === 'strength') {
    return week.focusRaceId === null
      ? undefined
      : sessionTexts.strengthVariants.byRace[week.focusRaceId];
  }

  if (session.sport === null) return undefined;
  return sessionTexts.sportVariants[`${session.sport}.${session.type}`];
}

/**
 * Titel och instruktion från `config/sessions.json` (R-30).
 *
 * Sportspecifika varianter går före den allmänna texten: simteknik beskrivs
 * inte som skidteknik. Saknas en kombination är det ett fel i konfigurationen
 * och ska märkas som ett kastat undantag, inte som ett tomt fält.
 */
function withTitleAndInstruction(
  session: Session,
  week: WeekSkeleton,
  index: number,
  input: PlanInput,
): Session {
  const variant = textVariantFor(session, week);
  const allmän = sessionTexts.types[session.type];

  const text = variant ?? allmän;
  if (text === undefined) {
    throw new Error(
      `config/sessions.json saknar text för passtypen "${session.type}"` +
        ` (vecka ${week.index}, pass ${index + 1})`,
    );
  }

  const grund: Session = {
    ...session,
    title: text.title,
    instruction: text.instruction,
    alternatives: alternativesFor(session, input),
  };

  return withRaceNote(withSafetyNote(withSubstitution(grund, input), input));
}

/**
 * Lopptaktiken på loppdagen (R-30).
 *
 * Råd som hör till loppet och inte till träningen: motströmmen i Vanån,
 * klungan i Vätternrundan, att Lidingöloppet avgörs på sista milen. De
 * tränar man inte, man förhåller sig till dem — därför står de bara här,
 * och bara på loppdagen.
 */
function withRaceNote(session: Session): Session {
  if (session.type !== 'race' || session.raceId === undefined) return session;

  const taktik = sessionTexts.raceNotes.byRace[session.raceId];
  if (taktik === undefined) return session;

  return { ...session, instruction: `${session.instruction} ${taktik}` };
}

/**
 * Passet gjort på ett annat sätt när utrustningen saknas (R-17, R-18, R-20).
 *
 * Skidor utan snö eller rullskidor blir stakmaskin om användaren har en,
 * annars stavgång i backe. Simning utan simhall blir torrövningar. Cykel utan
 * cykel blir spinning. Tid och zon är oförändrade — det är hur passet görs som
 * ändras, inte vad det ska ge.
 *
 * Loppet ersätts aldrig: den som anmält sig till Vasaloppet åker Vasaloppet.
 * Simning i öppet vatten juni till augusti kräver ingen simhall (R-19).
 */
/**
 * Tillägget som delar ett för långt ersättningspass (R-44).
 *
 * Ett långpass på två och en halv timme i stakmaskin är samma rörelse hela
 * vägen. Passet behåller sin tid — skidträningen behövs — men instruktionen
 * säger hur den delas. Det blir inget andra pass av det: en dag bär ett pass
 * (R-42), och det här är ett pass som görs på två sätt.
 */
function splitNoteFor(
  substitute: { maxMinutes?: number | undefined; overflowKey?: string | undefined },
  text: { splitNote?: string | undefined },
  minutes: number,
): string {
  const { maxMinutes, overflowKey } = substitute;
  if (maxMinutes === undefined || overflowKey === undefined) return '';
  if (text.splitNote === undefined || minutes <= maxMinutes) return '';

  const resten = sessionTexts.substitutes[overflowKey];
  if (resten === undefined) {
    throw new Error(`config/sessions.json saknar ersättningen "${overflowKey}"`);
  }

  return text.splitNote
    .replace('{minutes}', String(minutes - maxMinutes))
    .replace('{other}', resten.title.toLowerCase());
}

/**
 * Ersättningen passet ska göras som, eller undefined (R-17, R-20).
 *
 * Två olika fall, och de är inte samma sak:
 *
 *  1. **Grenen går inte att göra som den är.** Det gäller skidor utanför
 *     vintern: utan snö blir passet rullskidor om användaren har dem, annars
 *     stakmaskin, annars stavgång i backe. Alla tre är skidträning och passet
 *     behåller grenen — stavgång i backe är hur man tränar för Vasaloppet där
 *     det inte finns snö, inte en nödlösning.
 *  2. **Samma träning på en annan plats.** Det gäller cykeln under vintern:
 *     har användaren en trainer eller kommer åt spinning görs passet inomhus.
 *     Saknas den planeras det som vanligt cykelpass — alla som gör en
 *     klassiker har cykel, så det finns inget att ersätta.
 */
interface Substitute {
  key: string;
  maxMinutes?: number | undefined;
  overflowKey?: string | undefined;
  /** Sant för en säsongsvariant: samma gren, annan plats (R-20). */
  sameSport: boolean;
}

function substituteFor(session: Session, input: PlanInput): Substitute | undefined {
  if (session.sport === null) return undefined;

  const utrustning = input.equipment as Record<string, boolean>;
  const har = (flaggor: readonly string[]): boolean =>
    flaggor.every((flagga) => utrustning[flagga] === true);

  // Fall 2: säsongsvarianten.
  if (isWinter(session.date)) {
    const variant = rules.substitutions.seasonVariants.inWinter[session.sport];
    if (variant !== undefined && har(variant.needs)) return { ...variant, sameSport: true };
  }

  // Fall 1: grenen kräver snö, och snö finns inte.
  const snögrenar: readonly string[] = rules.substitutions.snowSports;
  if (!snögrenar.includes(session.sport) || hasSnow(session.date, input)) return undefined;

  const kandidater = rules.substitutions.bySport[session.sport];
  const vald = kandidater?.find((kandidat) => har(kandidat.needs));

  return vald === undefined ? undefined : { ...vald, sameSport: false };
}

/**
 * Sant för ett datum i vintern (R-20).
 *
 * Bara månaden. Det är vintern som avgör om cykelpasset görs inomhus — en
 * trainer i januari handlar om mörker och väglag, inte om snötillgång.
 */
function isWinter(date: IsoDate): boolean {
  return rules.season.winterMonths.includes(monthOf(date));
}

/**
 * Sant när det finns snö att åka skidor på (R-17).
 *
 * Två villkor: en vintermånad **och** tillgång till ett spår. Bara månaden
 * räcker inte — bor man i Skåne ligger det ingen snö i januari heller, och en
 * plan som lägger fyrtiotre timmar längdskidor där är en plan som inte går att
 * följa.
 */
function hasSnow(date: IsoDate, input: PlanInput): boolean {
  if (!isWinter(date)) return false;

  const utrustning = input.equipment as Record<string, boolean>;
  return rules.substitutions.snowNeeds.every((flagga) => utrustning[flagga] === true);
}

function withSubstitution(session: Session, input: PlanInput): Session {
  if (session.sport === null || session.type === 'race' || session.type === 'rest') {
    return session;
  }
  const vald = substituteFor(session, input);
  if (vald === undefined) return session;

  const text = sessionTexts.substitutes[vald.key];
  if (text === undefined) {
    throw new Error(`config/sessions.json saknar ersättningen "${vald.key}"`);
  }

  return {
    ...session,
    title: text.title,
    instruction: text.instruction + splitNoteFor(vald, text, session.minutes),
    substitutedAs: vald.key,
    // En riktig ersättning är redan ett byte av gren. Att dessutom lista
    // alternativ skulle ge tre sätt att göra samma pass, vilket är ett för
    // många. En säsongsvariant är däremot samma gren på en annan plats — ett
    // cykelpass inomhus är fortfarande ett cykelpass, och alternativen till
    // det är lika giltiga som ute.
    alternatives: vald.sameSport ? session.alternatives : [],
  };
}

/** Sant för ett pass som planeras i öppet vatten (R-19). */
function isOpenWater(sport: Exclude<Session['sport'], null>, date: IsoDate): boolean {
  const grenar: readonly string[] = rules.substitutions.openWaterSports;
  if (!grenar.includes(sport)) return false;

  return rules.season.openWaterMonths.includes(monthOf(date));
}

/**
 * Säkerhetstexten för öppet vatten (R-19).
 *
 * Varje pass i öppet vatten bär den, ordagrant enligt kravspecens avsnitt 8.
 * Loppet undantas inte: Vansbrosimningen *är* öppet vatten.
 */
function withSafetyNote(session: Session, input: PlanInput): Session {
  if (session.sport === null) return session;
  if (session.type === 'rest') return session;
  if (session.substitutedAs !== undefined) return session;
  if (!isOpenWater(session.sport, session.date)) return session;

  void input;
  return { ...session, safetyNote: sessionTexts.safetyNotes.openWater.text };
}

/**
 * Grenarna passet också kan göras i (R-37).
 *
 * Träningsupplägget är långpass, intervaller och styrka — inte fyra separata
 * sporter. Grenen som står på passet är den som passar nästa lopp bäst, men
 * flera grenar ger samma konditionsträning, och den som hellre vill byta ska
 * kunna göra det utan att tappa poängen med passet.
 *
 * Ett alternativ krävs vara möjligt att faktiskt genomföra: grenen måste vara
 * i säsong, och användaren måste ha utrustningen. Att föreslå längdskidor i
 * juli, eller till någon utan skidor, gör planen otrovärdig.
 *
 * Loppet, vilan, styrkan och teknikpassen har inga alternativ. Ett teknikpass
 * i simning kan inte bytas mot cykel — då är det inte längre samma pass.
 */
function alternativesFor(session: Session, input: PlanInput): SessionAlternative[] {
  const regler = rules.sessionAlternatives;

  if (session.sport === null) return [];
  if (!regler.forTypes.includes(session.type)) return [];

  const månad = monthOf(session.date);

  return regler.interchangeable
    .filter((kandidat): kandidat is TrainedSport => kandidat !== session.sport)
    .filter((kandidat) => inSeason(kandidat, månad))
    .filter((kandidat) => hasEquipmentFor(kandidat, input, session.date))
    .map((kandidat) => ({
      sport: kandidat,
      title: alternativeTitle(kandidat, session.type),
      note: regler.notes[kandidat] ?? '',
    }));
}

/** Sant när grenen går att utöva den månaden (R-37). */
function inSeason(sport: TrainedSport, month: number): boolean {
  const månader = rules.sessionAlternatives.seasonalMonths[sport];
  return månader === undefined || månader.includes(month);
}

/**
 * Sant när användaren har utrustning för grenen (R-37).
 *
 * Minst en av grenens flaggor räcker: skidor går med antingen snö eller
 * rullskidor, eller med en stakmaskin. Grenar som inte kräver något —
 * löpning — går alltid.
 */
function hasEquipmentFor(sport: TrainedSport, input: PlanInput, date: IsoDate): boolean {
  const krav = rules.sessionAlternatives.requiresAnyEquipment[sport];
  if (krav === undefined) return true;

  // Finns snö krävs ingen utrustning för att åka skidor.
  const snögrenar: readonly string[] = rules.substitutions.snowSports;
  if (snögrenar.includes(sport) && hasSnow(date, input)) return true;

  const utrustning = input.equipment as Record<string, boolean>;
  return krav.some((flagga) => utrustning[flagga] === true);
}

/** Alternativets titel, med grenens egen variant om det finns en. */
function alternativeTitle(sport: TrainedSport, type: SessionType): string {
  const variant = sessionTexts.sportVariants[`${sport}.${type}`];
  return variant?.title ?? (sessionTexts.types[type]?.title ?? type);
}
