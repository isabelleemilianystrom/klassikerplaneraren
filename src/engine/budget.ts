/**
 * Veckotid och fördelning mellan sporter — steg 2 i genereringen.
 *
 * Här bestäms *hur många minuter* varje vecka innehåller och *vilken sport* de
 * tillhör. Vilka pass minuterna blir, och vilka dagar de hamnar på, kommer i
 * T-05.
 *
 * Rena funktioner, inga sidoeffekter. Alla siffror kommer ur `config/rules.json`.
 */
import { raceById, rules } from './config.ts';
import { addDays, monthOf } from './dates.ts';
import type { Level, Phase, PlanInput, RaceGoal, TrainedSport } from './types.ts';
import type { PlacedRace, WeekSkeleton } from './weeks.ts';
import { buildWeeks, placeRaces } from './weeks.ts';

/**
 * Sporterna i en fast ordning.
 *
 * Ordningen avgör vem som får en överskjuten minut när tiden inte går jämnt
 * upp. Den är därför med flit fast och inte beroende av i vilken ordning
 * användaren råkade välja sina lopp — samma indata ska ge samma plan.
 */
const SPORT_ORDER: readonly TrainedSport[] = ['ski', 'bike', 'swim', 'run'];

/** En veckas tidsbudget, uppdelad så att varje regel går att följa i efterhand. */
export interface WeekBudget {
  index: number;
  /** Fasens tid efter R-05, R-06 och R-07. Hela veckans belastning. */
  phaseMinutes: number;
  /** Loppens uppskattade tid i veckan (R-25). Ingår i `phaseMinutes`. */
  raceMinutes: number;
  /** Styrka (R-10). */
  strengthMinutes: number;
  /** Konditionstid kvar att fördela mellan sporterna. */
  enduranceMinutes: number;
  /**
   * Minuter per sport, efter nybörjartaken i R-31.
   *
   * Summan plus `unplacedMinutes` är alltid exakt `enduranceMinutes` (R-29) —
   * ingen minut får försvinna i en avrundning.
   */
  bySport: Partial<Record<TrainedSport, number>>;
  /**
   * Minuter som inte gick att lägga någonstans (R-29, R-31).
   *
   * Noll i normalfallet. Blir det mer än noll har varje sport i planen slagit
   * i sitt nybörjartak, och då är veckans faktiska tid lägre än den valda —
   * det ska visas för användaren, inte gömmas.
   */
  unplacedMinutes: number;
}

/** Sporterna planen omfattar, i fast ordning. Styrka räknas inte som en sport. */
export function sportsInPlan(input: PlanInput): TrainedSport[] {
  const valda = new Set(input.races.map((race) => raceById(race.id).sport));
  return SPORT_ORDER.filter((sport) => valda.has(sport));
}

/** Budgeten för varje vecka i planen. */
export function weekBudgets(input: PlanInput): WeekBudget[] {
  const races = placeRaces(input);
  const sports = sportsInPlan(input);
  const weeks = buildWeeks(input);

  // Veckorna byggs i ordning, inte oberoende av varandra: R-14 begränsar hur
  // mycket löptiden får öka från en vecka till nästa, och det går inte att
  // avgöra utan att veta vad veckan innan gav.
  const resultat: WeekBudget[] = [];

  // Referensen är senaste *normala* veckans löptid. Avlastning, nedtrappning,
  // återhämtning och loppveckor hoppas över: de är medvetet lätta och säger
  // inget om vad kroppen är van vid. Utan det skulle en återhämtningsvecka
  // efter ett lopp låsa löpningen på en nivå den inte kan växa ifrån.
  let runReference: number | null = null;

  for (const week of weeks) {
    const budget = weekBudget(week, input, races, sports, runReference);
    resultat.push(budget);

    // R-45: en vecka där löpningen är pausad säger heller ingenting om vad
    // kroppen är van vid. Blir den referens tror R-14 att löptiden var noll,
    // och då stängs taket av helt — löpningen växte till åtta timmar veckan
    // därpå, vilket är precis det taket finns för att förhindra.
    const pausad = fullFocusSportIn(week, sports, races);

    const normalVecka =
      (week.phase === 'base' || week.phase === 'specific') &&
      !week.isDeload &&
      week.raceIds.length === 0 &&
      budget.enduranceMinutes > 0 &&
      (pausad === null || pausad === 'run');

    if (normalVecka) runReference = budget.bySport.run ?? runReference;
  }

  return resultat;
}

function weekBudget(
  week: WeekSkeleton,
  input: PlanInput,
  races: readonly PlacedRace[],
  sports: readonly TrainedSport[],
  runReference: number | null,
): WeekBudget {
  const phaseMinutes = phaseBudget(week, input, races);

  // R-25: loppet är veckans största belastning och räknas av från budgeten.
  // Annars planeras träningspass ovanpå nio mil skidor.
  const raceMinutes = rules.raceLoad.subtractEstimatedRaceHours
    ? week.raceIds.reduce((summa, id) => summa + Math.round(raceById(id).estimatedHours * 60), 0)
    : 0;

  const kvar = Math.max(0, phaseMinutes - raceMinutes);

  // R-10: styrkan räknas in i veckotiden och tas före konditionen, så att den
  // inte trängs undan av ett långpass som vuxit.
  const strengthMinutes = Math.min(kvar, strengthBudget(week.phase));
  const enduranceMinutes = kvar - strengthMinutes;

  const fulltFokus = fullFocusSportIn(week, sports, races);

  const bySport = capRunVolume(
    splitBetweenSports(enduranceMinutes, week, input, sports, races),
    runReference,
    week,
    input,
    finishedSports(week, races),
    new Set(sports.filter((sport) => isDeferred(sport, week, input, races))),
    fulltFokus === null ? new Set() : new Set(sports.filter((sport) => sport !== fulltFokus)),
  );
  const placerat = Object.values(bySport).reduce((a, b) => a + b, 0);

  return {
    index: week.index,
    phaseMinutes,
    raceMinutes,
    strengthMinutes,
    enduranceMinutes,
    bySport,
    unplacedMinutes: enduranceMinutes - placerat,
  };
}

/**
 * Löptiden begränsad till tio procents ökning från veckan innan (R-14).
 *
 * Löpning sliter betydligt mer på kroppen än skidor och cykel, och en vecka
 * som plötsligt dubblar löptiden är en skaderisk. Taket blev akut när R-36
 * infördes: när de andra loppen är avklarade går deras tid till det sista
 * loppets gren, och är det Lidingöloppet växte löpningen från nittio minuter
 * till åtta timmar på en vecka.
 *
 * Jämförelsen görs mot senaste **normala** veckan, inte mot veckan precis
 * innan. R-14 undantar veckor efter avlastning, och skälet är att
 * avlastningsveckan är medvetet lätt — men undantaget får inte betyda att
 * taket släpps helt, för då kan löptiden femdubblas veckan efter en
 * avlastning. Att hoppa över de lätta veckorna i jämförelsen ger regelns
 * avsikt utan hålet.
 *
 * De minuter taket skär bort går till de andra grenarna, i proportion till
 * deras tid. Veckans totala tid är oförändrad (R-29).
 */
function capRunVolume(
  bySport: Partial<Record<TrainedSport, number>>,
  runReference: number | null,
  week: WeekSkeleton,
  input: PlanInput,
  finished: ReadonlySet<TrainedSport>,
  deferred: ReadonlySet<TrainedSport>,
  paused: ReadonlySet<TrainedSport>,
): Partial<Record<TrainedSport, number>> {
  const nu = bySport.run;
  if (nu === undefined || runReference === null || runReference === 0) return bySport;

  // Loppveckan har sin egen logik: där styr R-25, inte en ökningstakt.
  if (week.raceIds.length > 0) return bySport;

  const tak = Math.floor(runReference * (1 + rules.runVolume.maxWeeklyIncrease));
  if (nu <= tak) return bySport;

  const resultat = { ...bySport, run: tak };
  let kvar = nu - tak;

  // De frigjorda minuterna till de andra grenarna, en i taget till den som
  // har minst tid. Två tak gäller fortfarande: nybörjartaket i R-31 får inte
  // överskridas, och en gren vars lopp är avklarat ska inte få tillbaka tid
  // genom bakvägen (R-36) — skidor i augusti är inte ett alternativ bara för
  // att löpningen fick för mycket.
  const taketFör = (sport: TrainedSport): number => {
    // R-39: en gren som ännu inte börjat tränas tar inte emot något alls.
    // Till skillnad från en avklarad gren finns här inget säsongsundantag —
    // poängen är att grenen inte ska tränas än.
    if (deferred.has(sport)) return 0;

    // R-45 mot R-14: en pausad gren får ta emot det löptaket skär bort.
    // Pausen handlar om fokus, taket om skaderisk, och skaderisken väger
    // tyngre. Alternativet vore att löpningen tredubblades de två sista
    // veckorna före Lidingöloppet, eller att veckans tid krympte.
    void paused;

    // R-36: en avklarad gren får träna i sin egen säsong, men inte utanför.
    if (finished.has(sport) && !isOwnSeason(sport, monthOf(week.startDate))) return 0;

    const gräns = newLevelLimit(sport, input);
    if (gräns === null) return Number.POSITIVE_INFINITY;
    return Math.max(0, gräns.maxMinutesPerWeek - raceMinutesInSport(week, sport));
  };

  while (kvar > 0) {
    const medPlats = (Object.keys(resultat) as TrainedSport[]).filter(
      (sport) => sport !== 'run' && (resultat[sport] ?? 0) < taketFör(sport),
    );
    if (medPlats.length === 0) break;

    const minst = medPlats.reduce((a, b) => ((resultat[b] ?? 0) < (resultat[a] ?? 0) ? b : a));
    resultat[minst] = (resultat[minst] ?? 0) + 1;
    kvar -= 1;
  }

  // Finns det minuter kvar har varje annan gren slagit i sitt tak. Då får
  // löpningen behålla dem — hellre det än att veckan blir kortare än
  // användaren valt. Löptaket är en riktlinje, inte ett förbud.
  if (kvar > 0) resultat.run = tak + kvar;

  return resultat;
}

/**
 * Loppens tid i en viss sport den här veckan, öppningspasset inräknat.
 *
 * Används bara av nybörjartaken i R-31. Själva veckobudgeten räknar av loppet
 * i R-25, men det gör den för hela veckan och inte per sport.
 */
function raceMinutesInSport(week: WeekSkeleton, sport: TrainedSport): number {
  const egna = week.raceIds.filter((id) => raceById(id).sport === sport);
  if (egna.length === 0) return 0;

  const loppen = egna.reduce(
    (summa, id) => summa + Math.round(raceById(id).estimatedHours * 60),
    0,
  );

  return loppen + rules.raceDay.openerMinutesDayBefore;
}

/** Sportens tak för den som är ny i den, eller null om den inte har något (R-31). */
export function newLevelLimit(
  sport: TrainedSport,
  input: PlanInput,
): { maxMinutesPerWeek: number; maxSessionsPerWeek: number } | null {
  if (input.levels[sport] !== 'new') return null;
  return rules.newLevelLimits.bySport[sport] ?? null;
}

/**
 * Nybörjartaken tillämpade, med de frigjorda minuterna flyttade (R-31, R-29).
 *
 * En nybörjarkurs i simning är en timme i veckan. Får den som knappt kan simma
 * tre timmar simning i veckan är det ett program som inte går att följa, hur
 * rätt det än ser ut i en tabell.
 *
 * Minuterna som taket skär bort går till de sporter som har plats kvar. Har
 * ingen sport plats blir de kvar som `unplacedMinutes` — veckan blir då kortare
 * än den valda tiden, och det är sanningen om vad som går att träna.
 */
function applyNewLevelLimits(
  bySport: Partial<Record<TrainedSport, number>>,
  input: PlanInput,
  sports: readonly TrainedSport[],
  week: WeekSkeleton,
  races: readonly PlacedRace[],
  enduranceMinutes: number,
): Partial<Record<TrainedSport, number>> {
  const klara = finishedSports(week, races);
  const månad = monthOf(week.startDate);

  const tak = new Map<TrainedSport, number>();
  for (const sport of sports) {
    // Fynd F-7. `applyFinishedRaces` nollar en avklarad gren och ger tiden till
    // veckans fokusgren precis som R-36 säger — men den här funktionen körs
    // *efteråt* och delade ut sitt överskott "en i taget till den sport som har
    // mest utrymme kvar". Grenen med mest utrymme var den R-36 just nollat. I
    // P1:s loppvecka i juli gav det 35 minuter skidor, ett halvår efter
    // Vasaloppet.
    //
    // Spärren finns sedan tidigare i `capRunVolume` för löptaket i R-14, och
    // den har tre delar. Första försöket tog bara R-36-delen, och då rann de
    // trimmade minuterna i stället in i en gren som väntar — 51 brott mot R-39
    // i 21 planer. Delarna hör ihop: ett tak noll hindrar både att grenen får
    // tid och att den tar emot någon annans.

    // R-39: en gren som ännu inte börjat tränas tar inte emot något alls. Till
    // skillnad från en avklarad gren finns här inget säsongsundantag.
    if (isDeferred(sport, week, input, races)) {
      tak.set(sport, 0);
      continue;
    }

    // R-36: utanför sin säsong får en avklarad gren ingenting. Det var det här
    // F-7 handlade om — skidor i juli, ett halvår efter Vasaloppet.
    if (klara.has(sport) && !isOwnSeason(sport, månad)) {
      tak.set(sport, 0);
      continue;
    }

    // I sin *egen* säsong ska grenen bara behålla `keepShareInOwnSeason`, och
    // den halvan är medvetet inte gjord här. Taket skulle vara enkelt att sätta
    // — `Math.floor(enduranceMinutes * rules.afterRace.keepShareInOwnSeason)` —
    // men det frigör så mycket tid i veckorna efter ett lopp att den hamnar på
    // löpningen, och då bryts R-14 i placeringen: sex riktade tester gick röda
    // och `bestDateFor` gav löppass två dagar i rad till en ny löpare.
    //
    // Det är fynd F-3, den tysta reservutgången, och den ligger före i kön.
    // Återstoden är 125 brott i 21 planer, alla av formen "simning behåller
    // 44 procent efter Vansbro i juli" — se F-7 i kravspecens avsnitt 9.
    void enduranceMinutes;

    const gräns = newLevelLimit(sport, input);
    if (gräns === null) continue;

    // Loppet och dess öppningspass är redan tid i sporten och räknas av. Den
    // som är ny i simning har loppet som veckans simning — inget tröskelpass
    // ska läggas ovanpå 3 km i Vansbroån.
    tak.set(sport, Math.max(0, gräns.maxMinutesPerWeek - raceMinutesInSport(week, sport)));
  }
  if (tak.size === 0) return bySport;

  const resultat = { ...bySport };
  let över = 0;

  for (const [sport, gräns] of tak) {
    const har = resultat[sport] ?? 0;
    if (har > gräns) {
      över += har - gräns;
      resultat[sport] = gräns;
    }
  }

  // De frigjorda minuterna, en i taget till den sport som har mest utrymme
  // kvar. Enkelt, och alltid samma resultat för samma indata.
  while (över > 0) {
    const medPlats = sports.filter((sport) => {
      const gräns = tak.get(sport);
      return gräns === undefined || (resultat[sport] ?? 0) < gräns;
    });
    if (medPlats.length === 0) break;

    const minst = medPlats.reduce((a, b) =>
      (resultat[b] ?? 0) < (resultat[a] ?? 0) ? b : a,
    );
    resultat[minst] = (resultat[minst] ?? 0) + 1;
    över -= 1;
  }

  return resultat;
}

/**
 * Veckans tid före avdrag för lopp och styrka (R-05, R-06, R-07).
 *
 * Ordningen är: fasens andel, därefter avlastningsveckans 70 procent, därefter
 * taket för planens två första veckor. Taket ligger sist eftersom R-07 säger
 * "högst" — det är ett tak, inte en andel som räknas ovanpå.
 */
/**
 * Dagar i veckan som ligger på eller efter startdatumet (R-01).
 *
 * Sju i alla veckor utom den första. Börjar man mitt i veckan är den första
 * veckan kortare, och då ska både tiden och antalet pass följa med.
 */
export function daysAvailableIn(week: WeekSkeleton, input: PlanInput): number {
  if (week.startDate >= input.startDate) return 7;

  const dagar = [0, 1, 2, 3, 4, 5, 6].map((steg) => addDays(week.startDate, steg));
  return dagar.filter((datum) => datum >= input.startDate).length;
}

/**
 * Träningsdagar veckan faktiskt har kvar (R-01, R-11).
 *
 * Normalt det R-11 säger utifrån timmarna. Är veckan avkortad begränsas den
 * av dagarna som finns, minus den vilodag veckan alltid ska ha. En start på en
 * söndag ger därför noll: den enda dagen som återstår är vilodagen.
 */
export function trainingDaysAvailableIn(week: WeekSkeleton, input: PlanInput): number {
  const önskat = trainingDayCount(input.hoursPerWeek);
  const dagar = daysAvailableIn(week, input);
  if (dagar === 7) return önskat;

  return Math.max(0, Math.min(önskat, dagar - rules.trainingDays.minRestDays));
}
/** Antal träningsdagar veckan ska ha utifrån timmarna (R-11). */
function trainingDayCount(hoursPerWeek: number): number {
  const rad = rules.trainingDays.byHoursPerWeek.find(
    (kandidat) => hoursPerWeek <= kandidat.upToHours,
  );

  return rad?.days ?? (rules.trainingDays.byHoursPerWeek.at(-1)?.days as number);
}


function phaseBudget(week: WeekSkeleton, input: PlanInput, races: readonly PlacedRace[]): number {
  const T = input.hoursPerWeek * 60;
  let minuter = T * phaseShare(week, races);

  if (week.isDeload) {
    minuter *= rules.weekTime.deload.share;
  }

  if (week.index <= rules.weekTime.firstWeeks.count) {
    minuter = Math.min(minuter, T * rules.weekTime.firstWeeks.maxShare);
  }

  // R-01: veckan börjar på måndagen i startdatumets vecka, så börjar man en
  // fredag är veckans tre första dagar redan passerade. Veckan får då bara
  // den del av tiden som dagarna räcker till — en plan som lägger en hel
  // veckas träning på tre dagar är en plan som inte går att följa, och en som
  // lägger pass på gårdagen är värre än det (fynd F-1).
  //
  // Skalas efter **träningsdagar**, inte kalenderdagar: veckan ska ha minst en
  // vilodag (R-11), så en start på en söndag lämnar noll träningsdagar och
  // därmed noll tid. Annars byggdes pass som inte hade någon dag att ligga på.
  minuter *= trainingDaysAvailableIn(week, input) / trainingDayCount(input.hoursPerWeek);

  return Math.round(minuter);
}

/**
 * Fasens andel av T (R-05).
 *
 * Nedtrappningen trappar ner: 60 procent första veckan och 40 den andra, eller
 * 50 om nedtrappningen bara är en vecka lång. Vilken vecka det är räknas ut
 * från avståndet till loppet, inte från en räknare, så att blocklogiken i R-03
 * inte kan få den ur fas.
 */
function phaseShare(week: WeekSkeleton, races: readonly PlacedRace[]): number {
  if (week.phase !== 'taper') {
    return rules.weekTime.phaseShare[week.phase as Exclude<Phase, 'taper'>];
  }

  const race = races.find((kandidat) => kandidat.id === week.focusRaceId);
  if (race === undefined) {
    throw new Error(`Nedtrappningsvecka ${week.index} saknar sitt lopp`);
  }

  const { firstWeek, secondWeek, singleWeek } = rules.weekTime.taperShare;
  if (race.taperWeeks === 1) return singleWeek;

  // Loppveckan är nedtrappningens sista vecka.
  const veckorKvar = race.weekIndex - (week.index - 1);
  return veckorKvar >= 1 ? firstWeek : secondWeek;
}

/** Styrkans minuter i veckan (R-10). */
function strengthBudget(phase: Phase): number {
  return rules.strength.sessionsByPhase[phase] * rules.strength.minutesPerSession;
}

/**
 * Konditionstiden fördelad mellan sporterna (R-08, R-09).
 *
 * Summan är alltid exakt `minutes` (R-29).
 */
function splitBetweenSports(
  minutes: number,
  week: WeekSkeleton,
  input: PlanInput,
  sports: readonly TrainedSport[],
  races: readonly PlacedRace[],
): Partial<Record<TrainedSport, number>> {
  if (sports.length === 0 || minutes === 0) {
    return Object.fromEntries(sports.map((sport) => [sport, 0]));
  }

  const månad = monthOf(week.startDate);

  // R-45: de sista veckorna före ett lopp går hela tiden till loppets gren.
  // Då finns inget att fördela och inget att vikta — övriga grenar pausas.
  const fulltFokus = fullFocusSportIn(week, sports, races);
  if (fulltFokus !== null) {
    const andelar = sports.map((sport) => (sport === fulltFokus ? 1 : 0));
    return applyNewLevelLimits(
      distribute(minutes, sports, andelar),
      input,
      sports,
      week,
      races,
      minutes,
    );
  }

  const grund =
    week.phase === 'specific' || week.phase === 'taper'
      ? specificShares(week, sports, månad, input, races)
      : seasonSharesWithNewBonus(månad, input, sports, week, races);

  // R-36: en gren vars lopp är avklarat lämnar plats åt nästa lopps gren.
  const andelar = applyFinishedRaces(grund, sports, week, races, månad);

  return applyNewLevelLimits(
      distribute(minutes, sports, andelar),
      input,
      sports,
      week,
      races,
      minutes,
    );
}

/**
 * Specifik fas och nedtrappning: loppets sport får huvuddelen (R-08).
 *
 * Andelen beror på hur många sporter planen innehåller. Med en enda sport går
 * allt dit, med två går 65 procent till loppets sport, annars 55.
 *
 * Resten fördelas mellan de övriga efter säsongens vikter (R-32) — den får
 * aldrig lämnas ofördelad. Ett cykelblock i maj lägger alltså sin
 * underhållstid på skidor och löpning olika mycket beroende på månad.
 */
/**
 * Grenen som tar hela veckan, eller null (R-45).
 *
 * De sista veckorna före ett lopp är det fullt fokus på det, och då pausas de
 * andra grenarna. Tre veckor före Vasaloppet gör ingen nytta i bassängen —
 * det som avgör är skidtid, och de timmarna gör mer nytta där.
 *
 * Antalet veckor står per lopp i `races.json` som `fullFocusWeeks`. Saknas
 * talet pausas ingenting. Veckan måste också ha loppet som sitt fokus: ligger
 * två lopp tätt (R-03) ska det ena loppets slutspurt inte stänga av det andras
 * uppbyggnad.
 */
function fullFocusSportIn(
  week: WeekSkeleton,
  sports: readonly TrainedSport[],
  races: readonly PlacedRace[],
): TrainedSport | null {
  if (week.focusRaceId === null) return null;

  const config = raceById(week.focusRaceId);
  const { fullFocusWeeks } = config;
  if (fullFocusWeeks === undefined) return null;

  const lopp = races.find((kandidat) => kandidat.id === week.focusRaceId);
  if (lopp === undefined) return null;

  // Veckor kvar till loppveckan. Noll är loppveckan själv, och den är
  // oförändrad: där gäller R-04, bara loppet och öppningspasset. Räknas den
  // med blir det fyra flaggade veckor i stället för tre.
  const kvar = lopp.weekIndex - (week.index - 1);
  if (kvar < 1 || kvar > fullFocusWeeks) return null;

  const sport = config.sport as TrainedSport;
  return sports.includes(sport) ? sport : null;
}

function specificShares(
  week: WeekSkeleton,
  sports: readonly TrainedSport[],
  month: number,
  input: PlanInput,
  races: readonly PlacedRace[],
): number[] {
  const { raceSportShare, raceSportShareWhenTwoSports, raceSportShareWhenOneSport } =
    rules.sportSplit.specific;

  const loppetsSport = week.focusRaceId === null ? null : raceById(week.focusRaceId).sport;
  const index = loppetsSport === null ? -1 : sports.indexOf(loppetsSport as TrainedSport);

  // Saknar veckan ett fokuslopp, eller tränas inte loppets sport i planen,
  // finns ingen sport att vikta mot. Då får säsongen bestämma ensam.
  if (index === -1) return seasonShares(month, sports, input, week, races);

  if (sports.length === 1) return [raceSportShareWhenOneSport];

  const huvudandel = sports.length === 2 ? raceSportShareWhenTwoSports : raceSportShare;

  // De övriga delar på resten, viktade efter säsongen.
  const övriga = sports.filter((_, i) => i !== index);
  const övrigaAndelar = seasonShares(month, övriga, input, week, races);

  // Är varje annan gren uppskjuten (R-39) finns ingen att dela med. Då tar
  // loppets gren hela veckan — tiden ska inte försvinna.
  if (övrigaAndelar.every((andel) => andel === 0)) {
    return sports.map((_, i) => (i === index ? 1 : 0));
  }

  let j = 0;
  return sports.map((_, i) =>
    i === index ? huvudandel : (1 - huvudandel) * (övrigaAndelar[j++] as number),
  );
}

/**
 * Säsongens vikter för sporterna i planen, normerade till 100 procent (R-32).
 *
 * Man behöver inte fokusera på alla grenar samtidigt. Vintern är skidornas och
 * sommaren cykelns — det är där de långa passen går att lägga utan att slita ut
 * kroppen, och det är de två längsta loppen.
 *
 * Månaden tas från veckans måndag. En vecka som ligger över ett månadsskifte
 * hör alltså till den månad den börjar i, vilket är enklare att förstå än att
 * vikta inom veckan.
 */
function seasonShares(
  month: number,
  sports: readonly TrainedSport[],
  input: PlanInput,
  week: WeekSkeleton,
  races: readonly PlacedRace[],
): number[] {
  const säsong = rules.seasonWeights.seasons.find((kandidat) =>
    kandidat.months.includes(month),
  );
  if (säsong === undefined) {
    throw new Error(`Månad ${month} hör inte till någon säsong i config/rules.json`);
  }

  const råa = sports.map((sport) => {
    // R-39: en gren som kan vänta får ingen tid alls än.
    if (isDeferred(sport, week, input, races)) return 0;

    return goalWeight(sport, weightFor(sport, säsong.weights[sport], input.levels), input);
  });
  const summa = råa.reduce((a, b) => a + b, 0);

  // Är varje gren i listan uppskjuten (R-39) blir summan noll. Returnera
  // nollorna som de är — anroparen avgör vad som ska hända med tiden.
  if (summa === 0) return råa;

  // Innehåller planen bara grenar med låg vikt för säsongen blir summan liten,
  // men andelarna ska ändå bli 100 procent av veckan.
  return råa.map((vikt) => vikt / summa);
}

/**
 * Sant när grenen kan vänta med att börja tränas (R-39).
 *
 * Man behöver inte träna alla grenar från dag ett. Är man van i en gren och
 * loppet inte kräver uppbyggd volym kan grenen vänta tills dess egen
 * uppbyggnad börjar — en erfaren simmare behöver inte simma i november för
 * ett lopp i juli.
 *
 * Fem villkor, alla måste gälla:
 *
 * - **Grenen står i `deferredSports.sports`.** Listan är kort och uttrycklig:
 *   i dag bara simning. Löpning och cykel står inte med, eftersom 30
 *   respektive 315 kilometer kräver uppbyggnad i månader.
 * - **Grenen är inte veckans fokus.** Basperioden mot ett lopp är just den
 *   uppbyggnad grenen behöver.
 * - **Användaren är inte nybörjare.** Teknik går inte att ta igen på slutet.
 * - **Loppet saknar volymriktmärke.** Den volymen byggs i månader.
 * - **Uppbyggnaden har inte börjat.** Veckan ligger före grenens egen
 *   specifika fas och nedtrappning.
 */
export function isDeferred(
  sport: TrainedSport,
  week: WeekSkeleton,
  input: PlanInput,
  races: readonly PlacedRace[],
): boolean {
  const kan: readonly string[] = rules.deferredSports.sports;
  if (!kan.includes(sport)) return false;

  // Veckans fokusgren är vad veckan handlar om.
  if (week.focusRaceId !== null && raceById(week.focusRaceId).sport === sport) return false;

  if (input.levels[sport] === 'new') return false;

  const race = races.find((kandidat) => raceById(kandidat.id).sport === sport);
  if (race === undefined) return false;

  if (raceById(race.id).volumeMilestoneKm !== undefined) return false;

  // Avklarade lopp hanteras av R-36, inte här.
  if (race.date < week.startDate) return false;

  const uppbyggnad = race.taperWeeks + race.specificWeeks;
  return race.weekIndex - (week.index - 1) > uppbyggnad;
}

/**
 * Vad användaren vill med grenens lopp, eller null om grenen inte har ett (R-38).
 */
function goalFor(sport: TrainedSport, input: PlanInput): RaceGoal | null {
  const race = input.races.find((kandidat) => raceById(kandidat.id).sport === sport);
  return race?.goal ?? null;
}

/**
 * Grenens vikt, sänkt för den som inte är nybörjare där regeln säger det (R-32).
 *
 * Vansbrosimningen är tre kilometer och fem procent av klassikerns lopptid. Den
 * som redan kan simma har tiden bättre använd på skidor eller cykel, där de två
 * långa loppen avgörs. Nybörjaren behåller sin tid — frekvens och teknik är det
 * som bygger simning, inte volym.
 */
function weightFor(
  sport: TrainedSport,
  seasonWeight: number,
  levels: PlanInput['levels'],
): number {
  if (isNew(levels[sport])) return seasonWeight;

  const sänkt = rules.seasonWeights.experiencedWeightOverride[sport];
  return sänkt ?? seasonWeight;
}

/**
 * Grenens vikt efter vad användaren vill med loppet (R-38).
 *
 * Den som bara vill ta sig i mål behöver vana och teknik, inte volym. Tiden
 * som frigörs går till de lopp hon faktiskt siktar på. Nybörjaren rörs inte:
 * för den som knappt kan simma är frekvensen själva förberedelsen, och
 * nybörjartaket i R-31 håller volymen nere ändå.
 */
function goalWeight(sport: TrainedSport, vikt: number, input: PlanInput): number {
  if (isNew(input.levels[sport])) return vikt;
  return goalFor(sport, input) === 'finish' ? vikt * rules.raceGoal.finishWeightFactor : vikt;
}

/**
 * Månaderna där grenen har sin högsta säsongsvikt — grenens egen säsong.
 *
 * För skidor är det vintern och för cykel sommaren. Det är de månader grenen
 * faktiskt går att utöva där man bor, och därmed de månader den kan användas
 * som konditionsträning även efter att dess lopp är avklarat (R-36).
 */
function isOwnSeason(sport: TrainedSport, month: number): boolean {
  const vikter = rules.seasonWeights.seasons.map((säsong) => säsong.weights[sport]);
  const högsta = Math.max(...vikter);

  const säsong = rules.seasonWeights.seasons.find((kandidat) =>
    kandidat.months.includes(month),
  );
  if (säsong === undefined) return false;

  return säsong.weights[sport] >= högsta;
}

/**
 * Vikterna justerade för lopp som redan är avklarade (R-36).
 *
 * Träningen ska fokusera på nästa kommande lopp. Är Vasaloppet avklarat ska
 * skidorna inte längre vara huvudgren — tiden går till cykeln inför
 * Vätternrundan. Men är det fortfarande vinter där man bor kan skidor
 * användas som långpass för konditionsträning, och då behåller grenen en liten
 * andel. Utanför sin egen säsong får den ingenting.
 *
 * Den frigjorda tiden går till veckans fokusgren, inte ut över alla grenar.
 * Annars hamnade den hos löpningen, som har jämn vikt året om — och ett halvår
 * före Lidingöloppet är det inte där tiden gör nytta.
 */
/** Grenarna vars lopp redan är avklarade när veckan börjar (R-36). */
function finishedSports(
  week: WeekSkeleton,
  races: readonly PlacedRace[],
): ReadonlySet<TrainedSport> {
  return new Set(
    races
      .filter((race) => race.date < week.startDate)
      .map((race) => raceById(race.id).sport as TrainedSport),
  );
}

function applyFinishedRaces(
  shares: readonly number[],
  sports: readonly TrainedSport[],
  week: WeekSkeleton,
  races: readonly PlacedRace[],
  month: number,
): number[] {
  const klaraGrenar = finishedSports(week, races);
  if (klaraGrenar.size === 0) return [...shares];

  const fokus = week.focusRaceId === null ? null : raceById(week.focusRaceId).sport;

  const { keepShareInOwnSeason } = rules.afterRace;
  const resultat = [...shares];
  let frigjort = 0;

  for (const [i, sport] of sports.entries()) {
    // Fokusgrenen rörs aldrig: är veckan en uppbyggnad mot ett lopp är den
    // grenen det veckan handlar om, oavsett vad som varit.
    if (!klaraGrenar.has(sport) || sport === fokus) continue;

    const behåll = isOwnSeason(sport, month) ? keepShareInOwnSeason : 0;
    const nu = resultat[i] as number;
    if (nu <= behåll) continue;

    frigjort += nu - behåll;
    resultat[i] = behåll;
  }

  if (frigjort === 0) return resultat;

  // Den frigjorda tiden till fokusgrenen. Saknar veckan en — det kan hända i
  // en plan vars sista lopp är avklarat — fördelas den på de grenar som finns
  // kvar, i proportion till deras vikt, så att inget försvinner.
  const fokusIndex = fokus === null ? -1 : sports.indexOf(fokus as TrainedSport);
  if (fokusIndex !== -1) {
    resultat[fokusIndex] = (resultat[fokusIndex] as number) + frigjort;
    return resultat;
  }

  const kvarvarande = resultat.reduce((a, b) => a + b, 0);
  if (kvarvarande === 0) return sports.map(() => 1 / sports.length);

  return resultat.map((andel) => andel + (frigjort * andel) / kvarvarande);
}

/**
 * Bas och återhämtning: säsongens vikter, med mer till den som är ny (R-09, R-32).
 *
 * De tio procentenheterna läggs på nybörjarsportens andel och tas från de
 * sporter där nivån är Van eller Erfaren. Att kunna cykla hjälper inte den som
 * inte kan simma, så tiden ska flyttas dit tekniken saknas.
 *
 * Ingen sport får pressas under halva den jämna andelen. Tiden tas från varje
 * van sport i proportion till hur mycket utrymme den har *över* golvet, inte i
 * proportion till dess andel — annars kan en sport med låg säsongsvikt tryckas
 * under golvet. Finns det inte tio procentenheter att hämta krymper bonusen
 * till det som går att ta.
 */
function seasonSharesWithNewBonus(
  month: number,
  input: PlanInput,
  sports: readonly TrainedSport[],
  week: WeekSkeleton,
  races: readonly PlacedRace[],
): number[] {
  const utgång = seasonShares(month, sports, input, week, races);

  // Skulle varje gren vara uppskjuten finns inget att fördela. Det ska inte
  // kunna hända — fokusgrenen skjuts aldrig upp — men en tom vecka vore ett
  // sämre fel än en jämn fördelning.
  if (utgång.every((andel) => andel === 0)) return sports.map(() => 1 / sports.length);

  const nya = sports.filter((sport) => isNew(input.levels[sport]));
  if (nya.length === 0 || nya.length === sports.length) return utgång;

  const { newLevelBonus, minShareOfEvenSplit } = rules.sportSplit.base;
  const golv = (1 / sports.length) * minShareOfEvenSplit;

  const utrymme = sports.map((sport, i) =>
    isNew(input.levels[sport]) ? 0 : Math.max(0, (utgång[i] as number) - golv),
  );
  const möjligt = utrymme.reduce((a, b) => a + b, 0);
  if (möjligt === 0) return utgång;

  const flyttat = Math.min(newLevelBonus * nya.length, möjligt);

  return sports.map((sport, i) =>
    isNew(input.levels[sport])
      ? (utgång[i] as number) + flyttat / nya.length
      : (utgång[i] as number) - (flyttat * (utrymme[i] as number)) / möjligt,
  );
}

function isNew(level: Level | undefined): boolean {
  return level === 'new';
}

/**
 * Minuterna fördelade enligt andelarna, utan att någon minut försvinner (R-29).
 *
 * Varje sport får sin heltalsdel, och de minuter som blir över av avrundningen
 * går till dem med störst kvarvarande decimal. Summan blir därmed exakt
 * `minutes`. Vid lika stor decimal avgör ordningen i `SPORT_ORDER`, så att
 * samma indata alltid ger samma fördelning.
 */
function distribute(
  minutes: number,
  sports: readonly TrainedSport[],
  shares: readonly number[],
): Partial<Record<TrainedSport, number>> {
  const exakta = shares.map((andel) => minutes * andel);
  const tilldelat = exakta.map((värde) => Math.floor(värde));

  let kvar = minutes - tilldelat.reduce((a, b) => a + b, 0);

  const efterDecimal = exakta
    .map((värde, i) => ({ i, decimal: värde - Math.floor(värde) }))
    .sort((a, b) => (b.decimal === a.decimal ? a.i - b.i : b.decimal - a.decimal));

  for (const { i } of efterDecimal) {
    if (kvar <= 0) break;
    tilldelat[i] = (tilldelat[i] as number) + 1;
    kvar -= 1;
  }

  return Object.fromEntries(sports.map((sport, i) => [sport, tilldelat[i] as number]));
}

/**
 * Grenarna som är pausade den här veckan för att loppet är nära (R-45).
 *
 * Finns för att tester och gränssnitt ska kunna fråga utan att räkna om
 * reglerna själva.
 */
export function pausedSportsIn(
  input: PlanInput,
  week: WeekSkeleton,
): Set<TrainedSport> {
  const sports = sportsInPlan(input);
  const fokus = fullFocusSportIn(week, sports, placeRaces(input));

  return fokus === null ? new Set() : new Set(sports.filter((sport) => sport !== fokus));
}

/**
 * Grenarna som ännu inte börjat tränas den här veckan (R-39).
 *
 * Finns för att tester och gränssnitt ska kunna fråga utan att räkna om
 * reglerna själva.
 */
export function deferredSportsIn(input: PlanInput, week: WeekSkeleton): Set<TrainedSport> {
  const races = placeRaces(input);

  return new Set(
    sportsInPlan(input).filter((sport) => isDeferred(sport, week, input, races)),
  );
}