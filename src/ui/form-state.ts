/**
 * Formulärets tillstånd och validering (K-02, K-03, K-04).
 *
 * Ren logik, skild från komponenterna: det går att pröva varje regel utan att
 * rendera något. Komponenterna håller tillståndet och frågar den här modulen
 * vad som är fel.
 *
 * Tillståndet är med flit lösare än `PlanInput` — ett halvifyllt formulär har
 * tomma datum och ovalda nivåer, och det är först när allt stämmer som det går
 * att bygga en `PlanInput`.
 */
import { nextRaceDate, raceById, races, rules } from '../engine/config.ts';
import { isIsoDate } from '../engine/dates.ts';
import { FORM } from './texts.ts';
import type { Level, PlanInput, RaceGoal, RaceId, TrainedSport, Weekday } from '../engine/types.ts';

/** Ett valt lopp i formuläret. Datumet är en sträng så länge det skrivs. */
export interface RaceChoice {
  id: RaceId;
  selected: boolean;
  date: string;
  /** Vad användaren vill med loppet (R-38). Förvalt är att ta sig i mål. */
  goal: RaceGoal;
}

export interface FormState {
  startDate: string;
  races: RaceChoice[];
  levels: Partial<Record<TrainedSport, Level>>;
  hoursPerWeek: number;
  longSessionDay: Weekday;
  restDay: Weekday;
  equipment: Record<string, boolean>;
}

/** Fel per fält. Nyckeln är fältets namn, värdet texten som visas vid fältet. */
export type FieldErrors = Record<string, string>;

/** Dagens datum som ISO-sträng. Skickas in, så att logiken förblir ren. */
export function initialState(today: string): FormState {
  return {
    startDate: today,
    // Alla fyra loppen listas; datumet förifylls med nästa publicerade (R-34
    // i config: `nextRaceDate` returnerar null när inget passar).
    races: races.races.map((race) => ({
      id: race.id,
      selected: false,
      date: nextRaceDate(race.id, today) ?? '',
      goal: 'finish',
    })),
    levels: {},
    hoursPerWeek: 6,
    longSessionDay: 7,
    restDay: 1,
    equipment: Object.fromEntries(
      ['snowOrRollerSkis', 'skiErg', 'pool', 'bike'].map((flagga) => [flagga, false]),
    ),
  };
}

/** Loppen användaren har valt. */
export function selectedRaces(state: FormState): RaceChoice[] {
  return state.races.filter((race) => race.selected);
}

/**
 * Grenarna som ingår i de valda loppen (K-03).
 *
 * Nivåfrågan ställs bara för de grenar användaren faktiskt ska tävla i. Att
 * fråga om simning av den som bara gör Vasaloppet är bara brus.
 */
export function sportsToRate(state: FormState): TrainedSport[] {
  const valda = new Set(selectedRaces(state).map((race) => raceById(race.id).sport));
  return (['ski', 'bike', 'swim', 'run'] as const).filter((sport) => valda.has(sport));
}

/** Felen i steg 1 (K-02). */
export function validateStep1(state: FormState): FieldErrors {
  const fel: FieldErrors = {};

  if (!isIsoDate(state.startDate)) {
    fel.startDate = FORM.step1.errors.startDateInvalid;
  }

  const valda = selectedRaces(state);
  if (valda.length === 0) {
    fel.races = FORM.step1.errors.noRace;
  }

  for (const race of valda) {
    if (race.date === '') {
      fel[`date-${race.id}`] = FORM.step1.errors.dateMissing;
      continue;
    }
    if (!isIsoDate(race.date)) {
      fel[`date-${race.id}`] = FORM.step1.errors.dateInvalid;
      continue;
    }
    // K-02: ett loppdatum före startdatumet går inte.
    if (isIsoDate(state.startDate) && race.date < state.startDate) {
      fel[`date-${race.id}`] = FORM.step1.errors.dateBeforeStart;
    }
  }

  return fel;
}

/** Felen i steg 2 (K-03). */
export function validateStep2(state: FormState): FieldErrors {
  const saknas = sportsToRate(state).filter((sport) => state.levels[sport] === undefined);
  return saknas.length === 0 ? {} : { levels: FORM.step2.error };
}

/** Felen i steg 3 (K-04). */
export function validateStep3(state: FormState): FieldErrors {
  const fel: FieldErrors = {};

  const { min, max } = hoursRange();
  if (
    !Number.isInteger(state.hoursPerWeek) ||
    state.hoursPerWeek < min ||
    state.hoursPerWeek > max
  ) {
    fel.hoursPerWeek = FORM.step3.errors.hours;
  }

  // Vilodagen ska vara helt fri, så den kan inte också bära veckans längsta pass.
  if (state.longSessionDay === state.restDay) {
    fel.restDay = FORM.step3.errors.sameDay;
  }

  return fel;
}

/**
 * Tillåtna timmar per vecka, ur konfigurationen.
 *
 * Nedre gränsen är kravspecens 3; den övre tas ur `trainingDays`, som är det
 * som faktiskt sätter taket för hur mycket tid motorn kan fördela.
 */
export function hoursRange(): { min: number; max: number } {
  const rader = rules.trainingDays.byHoursPerWeek;
  return { min: 3, max: rader.at(-1)?.upToHours ?? 15 };
}

/** Felen i alla tre stegen. */
export function validateAll(state: FormState): FieldErrors {
  return { ...validateStep1(state), ...validateStep2(state), ...validateStep3(state) };
}

/**
 * Formuläret som `PlanInput`, eller null när något är fel.
 *
 * Motorn ska aldrig få ett halvifyllt formulär. Returneras null finns felen i
 * `validateAll`, och användaren står kvar i formuläret.
 */
export function toPlanInput(state: FormState, today: string): PlanInput | null {
  if (Object.keys(validateAll(state)).length > 0) return null;

  return {
    schemaVersion: 3,
    today,
    startDate: state.startDate,
    races: selectedRaces(state).map((race) => ({
      id: race.id,
      date: race.date,
      goal: race.goal,
    })),
    levels: Object.fromEntries(
      sportsToRate(state).map((sport) => [sport, state.levels[sport] as Level]),
    ),
    hoursPerWeek: state.hoursPerWeek,
    preferredDays: { longSession: state.longSessionDay, rest: state.restDay },
    equipment: {
      snowOrRollerSkis: state.equipment.snowOrRollerSkis === true,
      skiErg: state.equipment.skiErg === true,
      pool: state.equipment.pool === true,
      bike: state.equipment.bike === true,
    },
  };
}
