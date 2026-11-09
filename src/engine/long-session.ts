/**
 * Veckans långpass (R-13, R-28, R-42, R-46).
 *
 * Det längsta passet i veckan, i loppets gren, på den dag användaren valt. Det
 * trappas upp vecka för vecka genom fasen och får låna tid från de andra
 * grenarna för att komma dit.
 *
 * Lärdomen från v0 bor här: **långpasset måste få sin del av veckan först.**
 * Ligger det sist i kön efter styrka, underhåll och kvalitetspass blir det
 * alltid för kort — det är den post som är lättast att knapra på.
 */
import { type WeekBudget } from './budget.ts';
import { raceById, rules } from './config.ts';
import { weekdayOf } from './dates.ts';
import { newLevelLimit } from './budget.ts';
import { hasWeeklyRequirement, needsTechnique, sessionFloor } from './session-limits.ts';
import type { IsoDate, PlanInput, TrainedSport } from './types.ts';
import type { WeekContext, WeekDays } from './week-context.ts';
import type { PlacedRace, WeekSkeleton } from './weeks.ts';
// Typimport: den erasas vid kompilering, så ingen cirkel uppstår.
import type { PendingSession } from './sessions.ts';

function reservedForRequiredSports(
  except: TrainedSport,
  week: WeekSkeleton,
  budget: WeekBudget,
  input: PlanInput,
  races: readonly PlacedRace[],
): number {
  let reserv = 0;

  for (const [gren, minuter] of Object.entries(budget.bySport) as [TrainedSport, number][]) {
    if (gren === except || minuter <= 0) continue;
    if (!hasWeeklyRequirement(gren, week, input, races)) continue;
    reserv += sessionFloor(gren);
  }

  return reserv;
}

/**
 * Hur långt långpasset växer den här veckan (R-13, R-42, R-46).
 *
 * Kurvan går från fasens startandel till dess slutandel, jämnt över fasens
 * veckor — men aldrig under veckans snitt, eftersom långpasset ska vara
 * veckans längsta pass (R-42).
 *
 * Snittet är **startpunkten**, inte ett golv under kurvan. Som golv blev
 * kurvan platt tills den hann upp och hoppade sedan: långpasset mot
 * Lidingöloppet låg på 75 minuter fyra veckor i rad och gick därefter till
 * 122 på en vecka. Sextiotre procent på en vecka är precis vad en
 * upptrappning finns för att undvika.
 */
function growthMinutes(ctx: WeekContext, cap: number, average: number): number {
  const kurva = rules.longSession.growthByPhase[ctx.week.phase as 'base'];

  // Hur långt genom fasen veckan ligger: 1/n i första veckan, 1 i den sista.
  const iFasen = ctx.allWeeks.filter((kandidat) => kandidat.phaseId === ctx.week.phaseId);
  const position = iFasen.findIndex((kandidat) => kandidat.index === ctx.week.index) + 1;
  const andelGenomFasen = position / iFasen.length;

  const start = Math.max(cap * kurva.startShareOfCap, average);
  const slut = Math.max(cap * kurva.endShareOfCap, start);

  return start + (slut - start) * andelGenomFasen;
}

/**
 * Kortaste långpass som är värt att lägga den här veckan (R-40, R-42).
 *
 * Grenens eget golv gäller — ett simpass på femtio minuter är lika mycket
 * besvär att ta sig till som ett på sextio — och dessutom det högsta golvet
 * bland alla grenar veckan tränar. Långpasset är veckans längsta pass, så ett
 * långpass på femtio minuter skulle klippa veckans simpass till femtio.
 *
 * Ryms inte golvet blir det inget långpass, och då är inget pass bundet av det.
 */
function floorMinutes(sport: TrainedSport, budget: WeekBudget): number {
  const golvIVeckan = (Object.entries(budget.bySport) as [TrainedSport, number][])
    .filter(([, minuter]) => minuter > 0)
    .map(([gren]) => sessionFloor(gren));

  return Math.max(rules.longSession.minMinutes, sessionFloor(sport), ...golvIVeckan);
}

/**
 * Veckans långpass, eller null när veckan inte rymmer ett (R-13, R-28, R-46).
 *
 * Tre tak gäller samtidigt: grenens eget i R-13, sjuttio procent av veckans
 * konditionstid i R-28, och det som måste lämnas kvar till en gren som ska
 * tränas varje vecka (R-31). Faller resultatet under golvet blir det inget
 * långpass.
 *
 * **Lånet följer kurvan hela fasen** (R-46). Långpasset får ta av veckans hela
 * konditionstid, inte bara av sin egen grens andel i R-08 — annars hinner det
 * aldrig bli långt nog, och ett långpass på tre timmar inför 315 kilometer på
 * cykel är inte en förberedelse utan en gissning. De lånade minuterna tas från
 * de övriga grenarna i proportion till deras tid, så veckans totala tid är
 * oförändrad (R-29).
 */
export function longSession(ctx: WeekContext, days: WeekDays): PendingSession | null {
  const { week, budget } = ctx;

  const iTillväxtfas = week.phase === 'base' || week.phase === 'specific';
  if (!iTillväxtfas || week.focusRaceId === null) return null;

  const sport = raceById(week.focusRaceId).sport as TrainedSport;

  // Har grenen ingen tid i veckan finns inget långpass att lägga.
  if ((budget.bySport[sport] ?? 0) === 0) return null;

  // F-8: är man ny i en teknikgren vars nybörjartak ger ett enda pass i
  // veckan ska det passet vara teknikpasset, inte långpasset. Två pass går
  // ändå inte att få in — R-40:s golv på sextio minuter mot R-31:s tak på
  // åttio gör det aritmetiskt omöjligt. Tekniken är det som gör 3 km i
  // Vansbroån görbart, och ett program som ger nybörjaren tjugoåtta veckor
  // långpass och aldrig ett teknikpass tränar fel sak. Grenen har alltså
  // inget långpass medan nivån är Ny. Beslut 2026-11-05, se R-21.
  const nybörjartak = newLevelLimit(sport, ctx.input);
  if (
    needsTechnique(sport, week.phase, ctx.input) &&
    nybörjartak !== null &&
    nybörjartak.maxSessionsPerWeek <= 1
  ) {
    return null;
  }

  const cap = rules.longSession.capMinutesBySport[sport];
  const average = ctx.slots <= 0 ? 0 : Math.ceil(budget.enduranceMinutes / ctx.slots);
  const golv = floorMinutes(sport, budget);

  // R-31: det som måste lämnas kvar till en nybörjargren dras av — men aldrig
  // så att långpasset faller under sitt eget golv. Räcker veckan inte till
  // båda behåller långpasset sin tid.
  const reserv = reservedForRequiredSports(sport, week, budget, ctx.input, ctx.races);
  const utrymme = Math.max(budget.enduranceMinutes - reserv, golv);

  const minuter = Math.min(
    Math.round(growthMinutes(ctx, cap, average)),
    cap,
    Math.floor(budget.enduranceMinutes * rules.longSession.maxShareOfWeek),
    rules.session.maxMinutes,
    utrymme,
  );

  if (minuter < golv) return null;

  const dag = longSessionDate(days);
  if (dag === null) return null;

  return { sport, type: 'long', minutes: minuter, zone: 2, fixedDate: dag };
}

/**
 * Dagen långpasset läggs på (R-13).
 *
 * Användarens valda dag går först. Är den upptagen av ett lopp eller ett
 * öppningspass tas den sista fria av standarddagarna i konfigurationen, och
 * sist någon annan fri dag — hellre ett långpass på fel dag än inget långpass.
 *
 * Vilodagen hålls fri även här. Den som har bett om en fri söndag ska inte få
 * veckans längsta pass just då.
 */
function longSessionDate(days: WeekDays): IsoDate | null {
  const fria = days.all.filter(
    (datum) =>
      !days.raceDates.has(datum) &&
      !days.openerDates.has(datum) &&
      weekdayOf(datum) !== days.preferred.rest,
  );

  const vald = fria.find((datum) => weekdayOf(datum) === days.preferred.longSession);
  if (vald !== undefined) return vald;

  // Är veckan avkortad (R-01) har den valda dagen passerat, inte blivit
  // upptagen. Då blir det inget långpass: reservdagen är veckans sista, och
  // ligger nästa veckas långpass på en måndag hamnar två långpass intill
  // varandra — vilket bryter mot R-43. Upptrappningen börjar i vecka 2.
  if (days.all.length < 7) return null;

  const standard = fria.filter((datum) =>
    rules.longSession.allowedWeekdays.includes(weekdayOf(datum)),
  );

  return standard.at(-1) ?? fria.at(-1) ?? null;
}
