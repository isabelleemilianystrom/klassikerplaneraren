/**
 * Varningar om planens förutsättningar.
 *
 * En varning betyder *"det här når inte ditt mål"*, aldrig *"du tränar för
 * lite"*. Appen är byggd för folk som arbetar, och en plan som tiger om sina
 * egna begränsningar är sämre än ingen plan.
 *
 * Motorn ändrar aldrig planen för att slippa en varning. Den säger vad som
 * gäller och låter användaren bestämma.
 *
 * Rena funktioner, inga sidoeffekter.
 */
import { raceById, rules } from './config.ts';
import {
  earliest,
  isIsoDate,
  latest,
  requireIsoDate,
  startOfWeek,
  weeksBetween,
} from './dates.ts';
import type { IsoDate, PlanInput, RaceId, TrainedSport } from './types.ts';
import type { WeekPlan } from './sessions.ts';

/** Ett lopp som ligger för nära starten för en hel uppbyggnad (R-35). */
export interface MidProgrammeStart {
  raceId: RaceId;
  /** Hela veckor från planens start till loppveckan. */
  weeksUntilRace: number;
  /** Veckor loppets egen uppbyggnad behöver: nedtrappning plus specifik fas. */
  weeksNeeded: number;
  /** Sant när planen saknar grundperiod helt. */
  withoutBase: boolean;
}

/**
 * Lopp som planen hoppar in mitt i uppbyggnaden mot (R-35).
 *
 * Gränsen är tio veckor och ligger i konfigurationen. Den är inte godtycklig:
 * tio veckor är hela uppbyggnaden för Vasaloppet och Vätternrundan — två
 * veckors nedtrappning plus åtta veckors specifik fas. Startar man senare än så
 * finns det ingen grundperiod kvar att göra.
 *
 * Bara det första loppet kontrolleras. De senare loppen har hela planen framför
 * sig och bygger upp sig i tur och ordning; att varna för dem vore att varna
 * för något som inte är ett problem.
 */
export function midProgrammeStarts(
  input: PlanInput,
  weeks: readonly WeekPlan[],
): MidProgrammeStart[] {
  const { weeksThreshold } = rules.warnings.midProgramme;

  const första = [...input.races].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (första === undefined) return [];

  const weeksUntilRace = weeksBetween(startOfWeek(input.startDate), startOfWeek(första.date));
  if (weeksUntilRace >= weeksThreshold) return [];

  const config = raceById(första.id);

  return [
    {
      raceId: första.id,
      weeksUntilRace,
      weeksNeeded: config.taperWeeks + config.specificWeeks,
      withoutBase: !weeks.some((plan) => plan.week.phase === 'base'),
    },
  ];
}

/** Varningstexterna för de lopp planen hoppar in mitt i (R-35). */
export function midProgrammeWarnings(starts: readonly MidProgrammeStart[]): string[] {
  const { text, noBaseSuffix } = rules.warnings.midProgramme;

  return starts.map((start) => {
    const grund = text
      .replace('{weeks}', weeksInWords(start.weeksUntilRace))
      .replace('{race}', raceById(start.raceId).name);

    return start.withoutBase ? grund + noBaseSuffix : grund;
  });
}

/**
 * Antal veckor i ord, med rätt böjning.
 *
 * "Det är 1 veckor till Vasaloppet" är den sortens fel som får en app att
 * kännas slarvig, och noll veckor betyder att loppet är den här veckan.
 */
function weeksInWords(weeks: number): string {
  if (weeks <= 0) return 'mindre än en vecka';
  if (weeks === 1) return '1 vecka';
  return `${weeks} veckor`;
}

/**
 * Kursrekommendationer för de grenar användaren är nybörjare i (R-21).
 *
 * Är man ny på längdskidor eller simning avgörs loppet av tekniken, inte av
 * konditionen, och en kurs ger mer än extra träningstid. Rekommendationen hör
 * i översikten, inte på varje pass — det är ett råd om hur man förbereder sig,
 * inte en instruktion för en enskild dag.
 *
 * Bara grenar vars lopp faktiskt ingår i planen räknas. Att rekommendera en
 * simkurs till den som inte ska simma Vansbrosimningen är bara brus.
 */
export function courseAdvice(input: PlanInput): string[] {
  const grenar = rules.technique.sportsForNewLevel;
  const iPlanen = new Set(input.races.map((race) => raceById(race.id).sport));

  return grenar
    .filter((sport) => iPlanen.has(sport))
    .filter((sport) => input.levels[sport as TrainedSport] === 'new')
    .map((sport) => rules.technique.courseAdvice[sport])
    .filter((råd): råd is string => råd !== undefined);
}

/**
 * Varningen om att loppen inte ryms i tolv månader (R-26).
 *
 * En svensk klassiker kräver att alla fyra loppen genomförs inom tolv månader.
 * Spänner de över mer än det är planen fortfarande ett träningsprogram, men
 * den är inte en klassikerplan — och det är hela poängen med appen. Planen
 * skapas ändå; kontrollen säger vad som gäller och låter användaren bestämma.
 *
 * Mäts från det första loppet till det sista. Ett enda lopp kan aldrig ligga
 * mer än tolv månader från sig självt.
 */
export function classicWindowWarnings(input: PlanInput): string[] {
  const { text } = rules.warnings.outsideClassicWindow;
  if (input.races.length < 2) return [];

  const datum = input.races.map((race) => race.date);
  const första = earliest(datum);
  const sista = latest(datum);

  // Tolv månader efter det första loppet är sista dagen som räknas.
  const gräns = addYear(första);
  return sista > gräns ? [text] : [];
}

/**
 * Samma datum ett år senare, som ISO-sträng.
 *
 * Skottår: är den 29 februari inte ett datum året därpå blir det den 28:e.
 * Utan det hade `2028-02-29` blivit `2029-03-01`, vilket är en dag för sent.
 */
function addYear(date: IsoDate): IsoDate {
  const år = Number(date.slice(0, 4)) + 1;
  const restenAvDatumet = date.slice(4);

  const kandidat = `${år}${restenAvDatumet}`;
  if (isIsoDate(kandidat) && kandidat.slice(4) === restenAvDatumet) {
    const prövning = new Date(`${kandidat}T00:00:00Z`);
    const samma = prövning.toISOString().slice(0, 10) === kandidat;
    if (samma) return kandidat;
  }

  return requireIsoDate(`${år}-02-28`, 'addYear');
}
