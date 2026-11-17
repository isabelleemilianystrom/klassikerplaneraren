/**
 * Formatering för planvyn (K-06, K-07, K-16).
 *
 * Ren logik utan React, så att varje format går att pröva i ett test. Vyn
 * frågar den här modulen hur något ska se ut och renderar svaret.
 */
import { raceById, rules } from '../engine/config.ts';
import { addDays, monthOf } from '../engine/dates.ts';
import type { WeekPlan } from '../engine/sessions.ts';
import type { IsoDate, Phase, Session, Zone } from '../engine/types.ts';
import { PLAN, SPORT_NAMES } from './texts.ts';

/** Fasernas namn i gränssnittet. */
const PHASE_NAMES: Record<Phase, string> = {
  base: 'Grund',
  specific: 'Loppspecifik',
  taper: 'Nedtrappning',
  recovery: 'Återhämtning',
};

const MONTH_NAMES = [
  '',
  'jan',
  'feb',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const;

const DAY_NAMES = ['', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

/** Fasens namn, som det visas för användaren. */
export function phaseName(phase: Phase): string {
  return PHASE_NAMES[phase];
}

/** Dagens namn utifrån veckodagen, måndag först. */
export function dayName(weekdayIso: number): string {
  return DAY_NAMES[weekdayIso] ?? '';
}

/**
 * Tid som "1 h 35 min".
 *
 * Minuter under en timme skrivs som minuter: "45 min" läses snabbare än
 * "0 h 45 min".
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const timmar = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${timmar} h` : `${timmar} h ${rest} min`;
}

/** Veckans datumintervall som "2–8 mars" eller "28 feb–6 mars". */
export function formatWeekRange(startDate: IsoDate): string {
  const slut = addDays(startDate, 6);

  const förstaDag = Number(startDate.slice(8));
  const sistaDag = Number(slut.slice(8));
  const förstaMånad = MONTH_NAMES[monthOf(startDate)];
  const sistaMånad = MONTH_NAMES[monthOf(slut)];

  return förstaMånad === sistaMånad
    ? `${förstaDag}–${sistaDag} ${sistaMånad}`
    : `${förstaDag} ${förstaMånad}–${sistaDag} ${sistaMånad}`;
}

/** Ett datum som "mån 2 mars". */
export function formatDay(date: IsoDate, weekdayIso: number): string {
  const dag = Number(date.slice(8));
  return `${dayName(weekdayIso).slice(0, 3).toLowerCase()} ${dag} ${MONTH_NAMES[monthOf(date)]}`;
}

/**
 * Intensiteten i vardagsspråk (K-07).
 *
 * "Lugnt – du ska kunna prata hela meningar (zon 2)". Zonen står sist och inom
 * parentes: den som vet vad zonerna betyder hittar den, och den som inte vet
 * får beskrivningen först.
 */
export function formatZone(zone: Zone | null, sport?: Session['sport']): string | null {
  if (zone === null) return null;

  const nyckel = String(zone) as '1';

  // Simning mäts på andningen, inte på hur mycket man kan prata.
  const text =
    sport === 'swim'
      ? rules.intensity.zoneTextBySport.swim[nyckel]
      : rules.intensity.zoneText[nyckel];

  return `${text} (zon ${zone})`;
}

/** Loppen som går i veckan, med sina namn. */
export function racesInWeek(plan: WeekPlan): string[] {
  return plan.week.raceIds.map((id) => raceById(id).name);
}

/**
 * Veckans fas och fokus som en rad: "Loppspecifik mot Vasaloppet".
 *
 * Fokusloppet står på veckan, aldrig på ett enskilt pass. Lärdomen från v0 är
 * att "intervaller mot Vasaloppet" på varje rad gör ett missat pass till ett
 * missat lopp — och pass missas, för folk blir sjuka och livet kommer emellan.
 */
export function weekFocus(plan: WeekPlan): string {
  const fas = phaseName(plan.week.phase);
  if (plan.week.focusRaceId === null) return fas;

  return `${fas} mot ${raceById(plan.week.focusRaceId).name}`;
}

/** Grenens namn på ett pass, eller null för vila. */
export function sessionSport(session: Session): string | null {
  return session.sport === null ? null : SPORT_NAMES[session.sport];
}

/**
 * Veckan som innehåller ett visst datum, eller null (K-16).
 *
 * Ligger datumet före planen börjar räknas den första veckan som aktuell: den
 * som skapat sin plan i förväg ska se var den börjar, inte ingenting.
 */
export function currentWeekIndex(plans: readonly WeekPlan[], today: IsoDate): number | null {
  const första = plans[0];
  const sista = plans.at(-1);
  if (första === undefined || sista === undefined) return null;

  if (today < första.week.startDate) return första.week.index;
  if (today > addDays(sista.week.startDate, 6)) return null;

  const vecka = plans.find(
    (plan) => today >= plan.week.startDate && today <= addDays(plan.week.startDate, 6),
  );
  return vecka?.week.index ?? null;
}

/**
 * Veckan att svara med högst upp i planen, eller null (designöversynen).
 *
 * Frågan en användare har på en tisdagsmorgon är "vad ska jag göra i dag?".
 * Svaret låg 1 273 pixlar och 726 ord ner i sidan, bakom sammanfattning,
 * förklaring, säkerhetstexter och varningar. Allt det ska stå kvar — men inte
 * före svaret.
 *
 * Är planen slut finns ingen vecka att visa, och då visas inget kort.
 */
export function currentWeek(plans: readonly WeekPlan[], today: IsoDate): WeekPlan | null {
  const index = currentWeekIndex(plans, today);
  if (index === null) return null;

  return plans.find((plan) => plan.week.index === index) ?? null;
}

/**
 * Sant när veckan har börjat (designöversynen).
 *
 * Den som skapar sin plan i förväg får första veckan som "aktuell" (se
 * `currentWeekIndex`), och då vore "Den här veckan" fel ord — veckan har inte
 * börjat. Kortet säger "Första veckan" i stället.
 */
export function hasWeekStarted(plan: WeekPlan, today: IsoDate): boolean {
  return today >= plan.week.startDate;
}

/** En stapel i årsremsan: en vecka, skalad mot den tyngsta veckan. */
export interface RibbonBar {
  /** Veckans nummer i planen. */
  index: number;
  /** Höjd i procent av remsans höjd, 4–100. */
  heightPercent: number;
  /** Vad stapeln är: en vanlig vecka, en avlastningsvecka eller en loppvecka. */
  kind: 'normal' | 'deload' | 'race';
  /** Hela stapeln i ord, för pekaren och för skärmläsaren. */
  label: string;
}

/**
 * Planen som en stapel per vecka (designöversynen 2026-11-17).
 *
 * Fyrtiofem identiska rader säger inte att programmet har en form. Samma tal
 * som redan står i varje rad — veckans minuter — säger det direkt när de ligger
 * bredvid varandra: uppbyggnaden i fyraveckorsblock, avlastningsveckan sist i
 * varje block, topparna där loppen ligger och dippen efter dem.
 *
 * Höjden är relativ till planens tyngsta vecka, aldrig absolut: en plan på sex
 * timmar i veckan och en på tolv ska båda fylla remsan. Golvet på fyra procent
 * finns för att en mycket lätt vecka annars försvinner helt.
 */
export function ribbonBars(plans: readonly WeekPlan[]): RibbonBar[] {
  const tyngst = plans.reduce((mest, plan) => Math.max(mest, plan.totalMinutes), 0);
  if (tyngst === 0) return [];

  return plans.map((plan) => {
    const lopp = racesInWeek(plan);

    return {
      index: plan.week.index,
      heightPercent: Math.max(4, Math.round((plan.totalMinutes / tyngst) * 100)),
      kind: lopp.length > 0 ? 'race' : plan.week.isDeload ? 'deload' : 'normal',
      label: ribbonLabel(plan, lopp),
    };
  });
}

/** Stapeln i ord: vecka, datum eller lopp, och tid. */
function ribbonLabel(plan: WeekPlan, lopp: string[]): string {
  const vad = lopp.length > 0 ? PLAN.raceWeek(lopp) : formatWeekRange(plan.week.startDate);
  const tid = formatMinutes(plan.totalMinutes);

  return `${PLAN.weekNumber(plan.week.index)} · ${vad} · ${tid}`;
}

/**
 * Sant när vyn ska rulla fram innevarande vecka i stället för att börja
 * högst upp (K-16).
 *
 * K-16 gäller **återbesöket**: "givet en sparad plan där några veckor
 * passerat". Två fall ska alltså *inte* rullas:
 *
 *  1. **En nygenererad plan.** Man har just tryckt på knappen och ska se vad
 *     man fick — rubriken, sammanfattningen, varningarna och säkerhetstexten
 *     står överst, och de ska läsas före vecka 1. Förut centrerades veckan
 *     alltid, vilket sköt hela huvudet ur bild och såg ut som att sidan
 *     öppnats på mitten.
 *  2. **Första veckan.** Är man i planens första vecka finns ingenting att
 *     leta efter, och att centrera den döljer bara det som står ovanför.
 */
export function shouldScrollToCurrentWeek(
  plans: readonly WeekPlan[],
  today: IsoDate,
  isReturningVisit: boolean,
): boolean {
  if (!isReturningVisit) return false;

  const aktuell = currentWeekIndex(plans, today);
  if (aktuell === null) return false;

  return aktuell !== plans[0]?.week.index;
}

/**
 * Veckorna grupperade i sina faser, för översikten (K-06, K-08).
 *
 * Grupperingen följer `phaseId`, som är samma för sammanhängande veckor i samma
 * fas mot samma lopp. Det är den enheten en fasförklaring hör till.
 */
export interface PhaseGroup {
  phaseId: string;
  phase: Phase;
  title: string;
  weeks: WeekPlan[];
}

export function groupByPhase(plans: readonly WeekPlan[]): PhaseGroup[] {
  const grupper: PhaseGroup[] = [];

  for (const plan of plans) {
    const sista = grupper.at(-1);

    if (sista !== undefined && sista.phaseId === plan.week.phaseId) {
      sista.weeks.push(plan);
      continue;
    }

    grupper.push({
      phaseId: plan.week.phaseId,
      phase: plan.week.phase,
      title: weekFocus(plan),
      weeks: [plan],
    });
  }

  return grupper;
}

/** Planens totala tid i timmar, avrundat. */
export function totalHours(plans: readonly WeekPlan[]): number {
  return Math.round(plans.reduce((summa, plan) => summa + plan.totalMinutes, 0) / 60);
}
