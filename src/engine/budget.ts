/**
 * Veckotid och fördelning mellan sporter — steg 2 i genereringen.
 *
 * Här bestäms *hur många minuter* varje vecka innehåller och *vilken sport* de
 * tillhör. Vilka pass minuterna blir, och vilka dagar de hamnar på, kommer i
 * T-05.
 *
 * Rena funktioner, inga sidoeffekter. Alla siffror kommer ur `config/rules.json`.
 */
import { raceById, rules } from './config';
import type { Level, Phase, PlanInput, TrainedSport } from './types';
import type { PlacedRace, WeekSkeleton } from './weeks';
import { buildWeeks, placeRaces } from './weeks';

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
   * Minuter per sport. Summerar alltid exakt till `enduranceMinutes` (R-29) —
   * ingen minut får försvinna i en avrundning.
   */
  bySport: Partial<Record<TrainedSport, number>>;
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

  return {
    index: week.index,
    phaseMinutes,
    raceMinutes,
    strengthMinutes,
    enduranceMinutes,
    bySport: splitBetweenSports(enduranceMinutes, week, input, sports),
  };
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

  return distribute(minutes, sports, andelar);
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
 * R-09 säger "+10 procentenheter för sporter där nivån är Ny". Är flera sporter
 * nya överskrider summan 100 procent — fyra sporter med två nya ger
 * 35 + 35 + 25 + 25 = 120. Andelarna normeras därför till 100 procent efteråt.
 * Den nya sporten får då mer tid än de övriga, men inte nödvändigtvis hela tio
 * procentenheter mer. Se den öppna frågan i kravspecens avsnitt 3.
 */
function evenSharesWithNewBonus(input: PlanInput, sports: readonly TrainedSport[]): number[] {
  const jämnt = 1 / sports.length;
  const bonus = rules.sportSplit.base.newLevelBonus;

  const råa = sports.map((sport) => jämnt + (isNew(input.levels[sport]) ? bonus : 0));
  const summa = råa.reduce((a, b) => a + b, 0);

  return råa.map((andel) => andel / summa);
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
