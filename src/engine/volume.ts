/**
 * Volymriktmärken per lopp (R-34).
 *
 * Många säger att man bör ha cyklat 1000 kilometer innan Vätternrundan. Det är
 * inte ett enskilt långpass utan **summan av alla pass** i grenen före loppet,
 * och det är ett riktmärke som går att kontrollera — till skillnad från en
 * känsla av att vara förberedd.
 *
 * Motorn ändrar aldrig planen för att nå ett riktmärke. Den totala volymen
 * följer av hur många timmar användaren kan träna och hur många veckor hon har,
 * och båda har hon valt själv. Det motorn gör är att räkna ut vad planen
 * faktiskt ger och säga till när det ligger under riktmärket.
 *
 * Rena funktioner, inga sidoeffekter.
 */
import { raceById, rules } from './config.ts';
import type { PlanInput, RaceId, TrainedSport } from './types.ts';
import type { WeekPlan } from './sessions.ts';

/** Vad planen ger i en gren före ett lopp, jämfört med riktmärket. */
export interface VolumeCheck {
  raceId: RaceId;
  sport: TrainedSport;
  /** Träningstid i grenen före loppet, i minuter. Loppet självt räknas inte. */
  minutes: number;
  /** Minuterna omräknade till kilometer med grenens träningsfart. */
  kilometers: number;
  /** Riktmärket från `config/races.json`. */
  milestoneKm: number;
  /** Sant när planen når riktmärket. */
  reached: boolean;
}

/**
 * Grenens träningsfart i km/h, eller null när den inte är känd.
 *
 * Farten används bara för att räkna om tid till kilometer i riktmärket, aldrig
 * för att planera ett pass. Den är lägre än loppfarten för cykel, eftersom
 * Vätternrundan körs i klunga och ett träningspass oftast görs ensam.
 */
export function trainingSpeedKmh(sport: TrainedSport): number | null {
  const fart = rules.trainingSpeedKmh[sport];
  return typeof fart === 'number' ? fart : null;
}

/**
 * Volymkontrollerna för de lopp som har ett riktmärke.
 *
 * Lopp utan riktmärke, och grenar utan känd träningsfart, hoppas över. Hellre
 * ingen kontroll än en kontroll byggd på ett påhittat tal.
 */
export function volumeChecks(input: PlanInput, weeks: readonly WeekPlan[]): VolumeCheck[] {
  const resultat: VolumeCheck[] = [];

  for (const race of input.races) {
    const config = raceById(race.id);
    const milestoneKm = config.volumeMilestoneKm;
    if (milestoneKm === undefined) continue;

    const sport = config.sport as TrainedSport;
    const fart = trainingSpeedKmh(sport);
    if (fart === null) continue;

    const minutes = trainingMinutesBefore(weeks, sport, race.date);
    const kilometers = Math.round((minutes / 60) * fart);

    resultat.push({
      raceId: race.id,
      sport,
      minutes,
      kilometers,
      milestoneKm,
      reached: kilometers >= milestoneKm,
    });
  }

  return resultat;
}

/**
 * Träningstiden i en gren före ett datum.
 *
 * Loppet självt ligger på loppdagen och faller därmed utanför: riktmärket
 * handlar om förberedelsen, inte om tävlingen. Öppningspasset dagen före är
 * träning och räknas med, vilket är rätt — det är tid i sadeln.
 *
 * Vilodagarna har noll minuter, men filtreras bort ändå så att en framtida
 * ändring av vilopassen inte kan smyga in tid här.
 */
function trainingMinutesBefore(
  weeks: readonly WeekPlan[],
  sport: TrainedSport,
  date: string,
): number {
  let minuter = 0;

  for (const plan of weeks) {
    for (const session of plan.sessions) {
      if (session.sport !== sport) continue;
      if (session.type === 'rest') continue;
      if (session.date >= date) continue;

      minuter += session.minutes;
    }
  }

  return minuter;
}

/**
 * Varningstexterna för de riktmärken planen inte når (R-34).
 *
 * Tonen är medveten: en varning betyder "det här når inte riktmärket", aldrig
 * "du tränar för lite". Appen är byggd för folk som arbetar, och planen är lagd
 * för att distansen ska gå att klara även när riktmärket inte nås.
 */
export function volumeWarnings(checks: readonly VolumeCheck[]): string[] {
  const { text } = rules.warnings.volumeMilestone;

  return checks
    .filter((check) => !check.reached)
    .map((check) =>
      text
        .replace('{km}', String(check.kilometers))
        .replace('{sport}', sportName(check.sport))
        .replace('{race}', raceById(check.raceId).name)
        .replace('{milestone}', String(check.milestoneKm)),
    );
}

/** Grenens namn i en varningstext, i den form meningen kräver. */
function sportName(sport: TrainedSport): string {
  const namn: Record<TrainedSport, string> = {
    ski: 'skidor',
    bike: 'cykel',
    swim: 'simning',
    run: 'löpning',
  };
  return namn[sport];
}

/**
 * Planen med uppmuntran på långpassen i de grenar som inte når riktmärket (R-48).
 *
 * Den som har begränsat med tid når inte tusen kilometer på cykel före
 * Vätternrundan, och det säger varningen i R-34 redan. Men varningen står i
 * planens topp, och det är på **passet** beslutet tas: har dagen mer tid än
 * planen räknat med är det långpasset som ska förlängas, inte ett extra pass
 * som ska läggas till.
 *
 * Tonen är ett erbjudande. Användaren har valt sina timmar själv, och planen
 * räcker för att klara distansen — det här är för de dagar då tiden råkar
 * finnas. Lärdomen från v0: en varning ska betyda "det här når inte ditt mål",
 * aldrig "du tränar för lite".
 *
 * Uppmuntran läggs bara på långpass i grenen, och bara på pass före loppet.
 * Efter loppet är riktmärket inte längre något att närma sig.
 */
export function withVolumeEncouragement(
  plans: readonly WeekPlan[],
  input: PlanInput,
): WeekPlan[] {
  const missade = volumeChecks(input, plans).filter((check) => !check.reached);
  if (missade.length === 0) return [...plans];

  const { sessionEncouragement } = rules.warnings.volumeMilestone;

  return plans.map((plan) => ({
    ...plan,
    sessions: plan.sessions.map((session) => {
      if (session.type !== 'long' || session.sport === null) return session;

      const check = missade.find((kandidat) => kandidat.sport === session.sport);
      if (check === undefined) return session;

      const race = raceById(check.raceId);
      if (session.date >= raceDateIn(input, check.raceId)) return session;

      return {
        ...session,
        instruction:
          session.instruction +
          sessionEncouragement
            .replace('{race}', race.name)
            .replace('{milestone}', String(check.milestoneKm)),
      };
    }),
  }));
}

/** Loppets datum i den här planen. */
function raceDateIn(input: PlanInput, raceId: RaceId): string {
  const race = input.races.find((kandidat) => kandidat.id === raceId);
  if (race === undefined) throw new Error(`Loppet ${raceId} finns inte i planen`);

  return race.date;
}
