/**
 * Generalrepet före loppet (R-49).
 *
 * Grenens sista pass före nedtrappningen bär en påminnelse om att köra det i
 * den utrustning och med den mat och dryck man tänkt använda i loppet.
 *
 * **Varför just det passet.** Upptäcker man att skorna skaver, att gelen inte
 * går ner eller att våtdräkten stryper över halsen ska det finnas tid kvar att
 * göra något åt det. Ligger generalrepet inne i nedtrappningen är det för sent
 * — då återstår bara att hoppas.
 *
 * **Varför en gång och inte varje vecka.** Står samma påminnelse på varje
 * långpass slutar man läsa den, och då är poängen borta. Det är samma lärdom
 * som ligger bakom att fokusloppet står på veckan och aldrig på ett enskilt
 * pass.
 *
 * Idén är hämtad ur SPÅRAT:s längdguide, som kör ett genrep två veckor före
 * Vasaloppet. Här är den generaliserad till alla fyra loppen, eftersom en
 * klassiker har fyra uppsättningar utrustning att prova.
 */
import { raceById, sessions as sessionTexts } from './config.ts';
import type { WeekPlan } from './sessions.ts';
import type { PlanInput, RaceId, Session, TrainedSport } from './types.ts';

/** Veckan där nedtrappningen mot ett lopp börjar, eller loppveckan. */
function taperStartFor(plans: readonly WeekPlan[], raceId: RaceId): number {
  const nedtrappning = plans.find(
    (plan) => plan.week.phase === 'taper' && plan.week.focusRaceId === raceId,
  );
  if (nedtrappning !== undefined) return nedtrappning.week.index;

  // Saknas nedtrappning — det händer när loppet ligger så tidigt att planen
  // inte hinner dit — räknas loppveckan som gränsen.
  const loppveckan = plans.find((plan) => plan.week.raceIds.includes(raceId));
  return loppveckan?.week.index ?? Number.POSITIVE_INFINITY;
}

/**
 * Passet som ska bära generalrepet, eller null.
 *
 * Långpasset först: det är där man är ute längst och hinner märka vad som
 * skaver. Ersatta pass räknas inte alls. Finns inget långpass i grenen tas
 * grenens sista pass i stället — den
 * som är ny på simning har bara ett teknikpass (R-21), och det är just hon som
 * behöver prova våtdräkten före Vansbro.
 */
function rehearsalSessionId(
  plans: readonly WeekPlan[],
  sport: TrainedSport,
  förstaNedtrappningsveckan: number,
): string | null {
  const kandidater: Session[] = [];

  for (const plan of plans) {
    if (plan.week.index >= förstaNedtrappningsveckan) continue;

    for (const session of plan.sessions) {
      if (session.sport !== sport) continue;
      if (session.type === 'rest' || session.type === 'race') continue;

      // Aldrig på ett ersatt pass (R-17). Utrustningen går inte att prova i en
      // ersättning: "kör passet i din Vasaloppsutrustning" på en stavgångsrunda
      // i backe är ett råd som inte går att följa. Har grenen bara ersatta pass
      // — ingen snö alls — blir det inget generalrep i den grenen, och det är
      // rätt. Den som aldrig kommer ut på snö har ett större problem än vallan,
      // och R-24 säger redan det.
      if (session.substitutedAs !== undefined) continue;

      kandidater.push(session);
    }
  }

  const långpass = kandidater.filter((session) => session.type === 'long');
  const valda = långpass.length > 0 ? långpass : kandidater;

  return valda.at(-1)?.id ?? null;
}

/** Planen med generalrepets påminnelse på ett pass per lopp (R-49). */
export function withRaceRehearsal(
  plans: readonly WeekPlan[],
  input: PlanInput,
): WeekPlan[] {
  const { text, bySport } = sessionTexts.rehearsalNotes;

  // Ett pass-id per lopp, så att påminnelsen inte kan hamna på två pass.
  const valda = new Map<string, RaceId>();

  for (const race of input.races) {
    const sport = raceById(race.id).sport as TrainedSport;
    const id = rehearsalSessionId(plans, sport, taperStartFor(plans, race.id));
    if (id === null) continue;

    valda.set(id, race.id);
  }

  if (valda.size === 0) return [...plans];

  return plans.map((plan) => ({
    ...plan,
    sessions: plan.sessions.map((session) => {
      const raceId = valda.get(session.id);
      if (raceId === undefined) return session;

      const race = raceById(raceId);
      const grenens = bySport[race.sport as TrainedSport] ?? '';

      return {
        ...session,
        instruction:
          session.instruction + text.replace('{race}', race.name).replace('{sport}', grenens),
      };
    }),
  }));
}
