/**
 * Veckorna och deras faser — steg 1 i genereringen.
 *
 * Här bestäms *vilka veckor planen omfattar* och *vad varje vecka ska göra*,
 * inte hur många minuter den innehåller eller vilka pass. Det kommer i T-04
 * och T-05.
 *
 * Rena funktioner, inga sidoeffekter. Dagens datum används inte alls här —
 * planen utgår från `startDate`, som användaren väljer.
 */
import { raceById, rules } from './config.ts';
import { addWeeks, endOfWeek, latest, startOfWeek, weeksBetween } from './dates.ts';
import type { IsoDate, Phase, PlanInput, RaceId, Week } from './types.ts';

/**
 * En vecka innan tid och pass fyllts i.
 *
 * `raceIds` är inte en del av `Week` i datamodellen — det är arbetsmaterial för
 * T-05, som behöver veta vilka lopp som infaller i veckan för att kunna skapa
 * ett pass av typen `race` per lopp (R-27).
 */
export interface WeekSkeleton extends Omit<Week, 'sessions' | 'totalMinutes'> {
  raceIds: RaceId[];
}

/** Ett lopp placerat på en vecka i planen. */
export interface PlacedRace {
  id: RaceId;
  date: IsoDate;
  weekIndex: number;
  taperWeeks: number;
  recoveryWeeks: number;
  specificWeeks: number;
}

/**
 * Planens sista dag: söndagen i veckan med det sista loppet (R-01).
 *
 * Planen sträcker sig alltså inte förbi sista loppet. Återhämtning efter det
 * loppet ligger utanför v1.0.
 */
export function planEndDate(input: PlanInput): IsoDate {
  return endOfWeek(latest(input.races.map((race) => race.date)));
}

/** Antal veckor planen omfattar, från startdatumets vecka till sista loppets. */
export function weekCount(input: PlanInput): number {
  return weeksBetween(startOfWeek(input.startDate), planEndDate(input)) + 1;
}

/**
 * Loppen placerade på veckor, i datumordning, med blocklogiken i R-03 tillämpad.
 *
 * Ligger två lopp mindre än fyra veckor isär förlorar det första sin
 * återhämtningsvecka och det andra får en veckas nedtrappning. Veckorna
 * däremellan blir då specifik fas för det andra loppet, vilket faller ut av
 * sig självt när fönstren räknas om.
 */
export function placeRaces(input: PlanInput): PlacedRace[] {
  const first = startOfWeek(input.startDate);

  const placed: PlacedRace[] = [...input.races]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((race) => {
      const config = raceById(race.id);
      return {
        id: race.id,
        date: race.date,
        weekIndex: weeksBetween(first, startOfWeek(race.date)),
        taperWeeks: config.taperWeeks,
        recoveryWeeks: config.recoveryWeeks,
        specificWeeks: config.specificWeeks,
      };
    });

  for (let i = 1; i < placed.length; i += 1) {
    const föregående = placed[i - 1] as PlacedRace;
    const detta = placed[i] as PlacedRace;
    const avstånd = detta.weekIndex - föregående.weekIndex;

    if (avstånd > 0 && avstånd < rules.blocks.sharedBlockMaxWeeks) {
      föregående.recoveryWeeks = 0;
      detta.taperWeeks = rules.blocks.taperWeeksWhenShared;
    }
  }

  return placed;
}

/**
 * Veckorna med fas, fokuslopp och avlastningsflagga.
 *
 * Fasen avgörs i prioritetsordningen i R-02: återhämtning, nedtrappning,
 * specifik, bas. Den första som matchar vinner.
 */
export function buildWeeks(input: PlanInput): WeekSkeleton[] {
  const first = startOfWeek(input.startDate);
  const races = placeRaces(input);
  const antal = weekCount(input);

  const veckor: WeekSkeleton[] = [];
  let sedanAvlastning = 0;

  for (let index = 0; index < antal; index += 1) {
    const startDate = addWeeks(first, index);
    const iVeckan = races.filter((race) => race.weekIndex === index);
    const { phase, focusRaceId } = phaseFor(index, races);

    // R-06: var fjärde vecka i bas och specifik fas är en avlastningsvecka.
    // Räknaren nollställs av varje nedtrappning och återhämtning, eftersom de
    // veckorna redan är lättare.
    let isDeload = false;
    if (phase === 'base' || phase === 'specific') {
      sedanAvlastning += 1;
      if (sedanAvlastning >= rules.weekTime.deload.everyNthWeek) {
        isDeload = true;
        sedanAvlastning = 0;
      }
    } else {
      sedanAvlastning = 0;
    }

    veckor.push({
      index: index + 1,
      startDate,
      phase,
      phaseId: '',
      focusRaceId,
      isDeload,
      // R-27: alla lopp i veckan hör till veckan, inte bara det första.
      raceIds: iVeckan.map((race) => race.id),
    });
  }

  return withPhaseIds(veckor);
}

/**
 * Veckans fas och vilket lopp den handlar om.
 *
 * Fönstren räknas ut per lopp: nedtrappningen slutar på loppveckan, specifik
 * fas ligger närmast före den, och återhämtningen följer efter loppveckan.
 */
function phaseFor(
  index: number,
  races: readonly PlacedRace[],
): { phase: Phase; focusRaceId: RaceId | null } {
  // Återhämtning först — den vinner över allt annat (R-02).
  for (const race of races) {
    const efter = index - race.weekIndex;
    if (efter > 0 && efter <= race.recoveryWeeks) {
      return { phase: 'recovery', focusRaceId: race.id };
    }
  }

  for (const race of races) {
    const kvar = race.weekIndex - index;
    if (kvar >= 0 && kvar < race.taperWeeks) {
      return { phase: 'taper', focusRaceId: race.id };
    }
  }

  for (const race of races) {
    const kvar = race.weekIndex - index;
    const specifikStart = race.taperWeeks + race.specificWeeks;
    if (kvar >= race.taperWeeks && kvar < specifikStart) {
      return { phase: 'specific', focusRaceId: race.id };
    }
  }

  // Bas: övrig tid, med nästa kommande lopp som fokus.
  const nästa = races.find((race) => race.weekIndex >= index);
  return { phase: 'base', focusRaceId: nästa?.id ?? null };
}

/**
 * Ger sammanhängande veckor i samma fas mot samma lopp ett gemensamt `phaseId`.
 *
 * Det är den identiteten förklaringarna hänger på: en fas får en text, inte
 * varje vecka.
 */
function withPhaseIds(veckor: readonly WeekSkeleton[]): WeekSkeleton[] {
  const resultat: WeekSkeleton[] = [];
  let aktuellt = '';

  for (const [i, vecka] of veckor.entries()) {
    const föregående = veckor[i - 1];
    const nyFas =
      föregående === undefined ||
      föregående.phase !== vecka.phase ||
      föregående.focusRaceId !== vecka.focusRaceId;

    if (nyFas) {
      aktuellt = `${vecka.phase}-${vecka.focusRaceId ?? 'none'}-w${vecka.index}`;
    }

    resultat.push({ ...vecka, phaseId: aktuellt });
  }

  return resultat;
}
