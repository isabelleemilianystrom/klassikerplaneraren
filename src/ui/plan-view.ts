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
import { SPORT_NAMES } from './texts.ts';

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
export function formatZone(zone: Zone | null): string | null {
  if (zone === null) return null;

  const text = rules.intensity.zoneText[String(zone) as '1'];
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
