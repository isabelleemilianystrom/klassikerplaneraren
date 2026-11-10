/**
 * Gränserna reglerna sätter på ett enskilt pass, och vilka grenar som måste
 * tränas (R-12, R-15, R-21, R-31, R-39, R-40, R-42).
 *
 * Här bor de frågor som andra moduler ställer om och om igen: hur kort och hur
 * långt får passet vara, hur hårt får det vara i den här fasen, och ska grenen
 * tränas den här veckan alls. Alla läser sina tal ur konfigurationen.
 *
 * Rena funktioner. Ingen av dem rör planen.
 */
import { isDeferred, newLevelLimit } from './budget.ts';
import { raceById, rules } from './config.ts';
import type { Level, Phase, PlanInput, TrainedSport } from './types.ts';
import type { PlacedRace, WeekSkeleton } from './weeks.ts';
// Typimport: den erasas vid kompilering, så ingen cirkel uppstår.
import type { PendingSession } from './sessions.ts';

/**
 * Kortaste pass som är värt att göra i en gren (R-40).
 *
 * De flesta grenar har bara träningstiden att betala. Simningen har mer: man
 * ska ta sig till simhallen, betala inträde och byta om, och det är lika
 * mycket besvär för tjugo minuter i vattnet som för en timme. Ett sådant pass
 * har ett högre golv, och räcker veckans tid inte till simmar man inte den
 * veckan.
 */
export function sessionFloor(sport: TrainedSport): number {
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
export function sessionCeiling(sport: TrainedSport): number {
  const perGren: Partial<Record<TrainedSport, number>> = rules.session.maxMinutesBySport;
  return perGren[sport] ?? rules.session.maxMinutes;
}

/**
 * Fasens tak på hård tid (R-15), eller null när fasen inte har något.
 *
 * Bara nedtrappningen har ett tak. R-15 säger "korta inslag i zon 3" om just
 * den fasen, och utan en siffra blev det ett helt tröskelpass på upp till två
 * timmar veckan före loppet.
 */
export function maxHardMinutes(phase: Phase): number | null {
  const fas = rules.intensity.byPhase[phase];
  return 'maxHardMinutes' in fas ? fas.maxHardMinutes : null;
}

/** Fasens högsta zon, nedsatt för den som är ny i sporten (R-15). */
export function maxZoneFor(phase: Phase, level: Level | undefined): number {
  const fas = rules.intensity.byPhase[phase];
  const nedsatt = 'maxZoneForNewLevel' in fas ? fas.maxZoneForNewLevel : undefined;

  return level === 'new' && nedsatt !== undefined ? Math.min(fas.maxZone, nedsatt) : fas.maxZone;
}

export function isHard(session: PendingSession): boolean {
  return session.zone !== null && session.zone >= 4;
}

/**
 * Sant när grenen ska ha ett teknikpass den här veckan (R-21).
 *
 * Är man ny i skidor eller simning avgörs loppet av tekniken, inte av
 * konditionen. Ett teknikpass per vecka under bas- och specifik fas — i
 * nedtrappning och återhämtning styr R-33 i stället.
 */
export function needsTechnique(sport: TrainedSport, phase: Phase, input: PlanInput): boolean {
  if (phase !== 'base' && phase !== 'specific') return false;

  const grenar: readonly string[] = rules.technique.sportsForNewLevel;
  return grenar.includes(sport) && input.levels[sport] === 'new';
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
export function hasWeeklyRequirement(
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

/**
 * Sporter som inte räcker till ett pass får stå över, och deras minuter
 * fördelas på de övriga (R-12, R-29).
 *
 * Vilken sport som står över roterar med veckonumret. Lärdomen från v0 är att
 * en fast ordning gör att samma gren alltid väljs bort — och då tränas en
 * fjärde gren aldrig, vilket är värst för den som är nybörjare i just den.
 */
/** Veckans fokusgren, eller null när veckan inte har något fokuslopp. */
export function focusSportOf(week: WeekSkeleton): TrainedSport | null {
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
export function focusSlotsNeeded(sport: TrainedSport, week: WeekSkeleton, input: PlanInput): number {
  if (rules.intensity.byPhase[week.phase].hardSessionsPerWeek === 0) return 0;

  // Krockar grenens golv med fasens tak på hårda minuter finns inget hårt
  // pass att lägga, och då behövs ingen extra plats.
  const tak = maxHardMinutes(week.phase);
  if (tak !== null && sessionFloor(sport) > tak) return 0;

  const teknik = needsTechnique(sport, week.phase, input) ? rules.technique.sessionsPerWeek : 0;
  return teknik + 1;
}
