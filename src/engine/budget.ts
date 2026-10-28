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
import type { Level, Phase, PlanInput, TrainedSport } from './types.ts';
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

  return buildWeeks(input).map((week) => weekBudget(week, input, races, sports));
}

function weekBudget(
  week: WeekSkeleton,
  input: PlanInput,
  races: readonly PlacedRace[],
  sports: readonly TrainedSport[],
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

  const bySport = splitBetweenSports(enduranceMinutes, week, input, sports);
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
): Partial<Record<TrainedSport, number>> {
  const tak = new Map<TrainedSport, number>();
  for (const sport of sports) {
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
function phaseBudget(week: WeekSkeleton, input: PlanInput, races: readonly PlacedRace[]): number {
  const T = input.hoursPerWeek * 60;
  let minuter = T * phaseShare(week, races);

  if (week.isDeload) {
    minuter *= rules.weekTime.deload.share;
  }

  if (week.index <= rules.weekTime.firstWeeks.count) {
    minuter = Math.min(minuter, T * rules.weekTime.firstWeeks.maxShare);
  }

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
): Partial<Record<TrainedSport, number>> {
  if (sports.length === 0 || minutes === 0) {
    return Object.fromEntries(sports.map((sport) => [sport, 0]));
  }

  const andelar =
    week.phase === 'specific' || week.phase === 'taper'
      ? specificShares(week, sports)
      : evenSharesWithNewBonus(input, sports);

  return applyNewLevelLimits(distribute(minutes, sports, andelar), input, sports, week);
}

/**
 * Specifik fas och nedtrappning: loppets sport får huvuddelen (R-08).
 *
 * Andelen beror på hur många sporter planen innehåller. Med en enda sport går
 * allt dit, med två går 65 procent till loppets sport, annars 55. Resten
 * fördelas jämnt mellan de övriga — den får aldrig lämnas ofördelad.
 */
function specificShares(week: WeekSkeleton, sports: readonly TrainedSport[]): number[] {
  const { raceSportShare, raceSportShareWhenTwoSports, raceSportShareWhenOneSport } =
    rules.sportSplit.specific;

  const loppetsSport = week.focusRaceId === null ? null : raceById(week.focusRaceId).sport;
  const index = loppetsSport === null ? -1 : sports.indexOf(loppetsSport as TrainedSport);

  // Saknar veckan ett fokuslopp, eller tränas inte loppets sport i planen,
  // finns ingen sport att vikta mot. Då är en jämn fördelning det rimliga.
  if (index === -1) return sports.map(() => 1 / sports.length);

  if (sports.length === 1) return [raceSportShareWhenOneSport];

  const huvudandel = sports.length === 2 ? raceSportShareWhenTwoSports : raceSportShare;
  const övriga = (1 - huvudandel) / (sports.length - 1);

  return sports.map((_, i) => (i === index ? huvudandel : övriga));
}

/**
 * Bas och återhämtning: jämnt mellan sporterna, mer till den som är ny (R-09).
 *
 * De tio procentenheterna läggs på nybörjarsportens andel och tas från de
 * sporter där nivån är Van eller Erfaren. Att kunna cykla hjälper inte den som
 * inte kan simma, så tiden ska flyttas dit tekniken saknas.
 *
 * Ingen sport får pressas under halva den jämna andelen. Är nästan alla
 * sporter nya finns det inte tio procentenheter att hämta, och då krymper
 * bonusen till det som går att ta. Golvet är det som gör att summan alltid
 * blir exakt 100 procent utan att någon sport blir utan tid.
 */
function evenSharesWithNewBonus(input: PlanInput, sports: readonly TrainedSport[]): number[] {
  const jämnt = 1 / sports.length;
  const nya = sports.filter((sport) => isNew(input.levels[sport]));
  const vana = sports.length - nya.length;

  // Ingen är ny, eller alla är nya: det finns inget att flytta tid mellan.
  if (nya.length === 0 || vana === 0) {
    return sports.map(() => jämnt);
  }

  const { newLevelBonus, minShareOfEvenSplit } = rules.sportSplit.base;
  const golv = jämnt * minShareOfEvenSplit;

  const önskat = newLevelBonus * nya.length;
  const möjligt = vana * (jämnt - golv);
  const flyttat = Math.min(önskat, möjligt);

  const tillNy = jämnt + flyttat / nya.length;
  const tillVan = jämnt - flyttat / vana;

  return sports.map((sport) => (isNew(input.levels[sport]) ? tillNy : tillVan));
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
