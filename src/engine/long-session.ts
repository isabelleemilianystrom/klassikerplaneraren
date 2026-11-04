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
import { hasWeeklyRequirement, sessionFloor } from './session-limits.ts';
import type { IsoDate, PlanInput, PreferredDays, TrainedSport } from './types.ts';
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

export function longSession(
  week: WeekSkeleton,
  budget: WeekBudget,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  allWeeks: readonly WeekSkeleton[],
  preferredDays: PreferredDays,
  input: PlanInput,
  races: readonly PlacedRace[],
  slots: number,
): PendingSession | null {
  const kurva = week.phase === 'base' || week.phase === 'specific'
    ? rules.longSession.growthByPhase[week.phase]
    : undefined;
  if (kurva === undefined || week.focusRaceId === null) return null;

  const sport = raceById(week.focusRaceId).sport as TrainedSport;
  const tillgängligt = budget.bySport[sport] ?? 0;
  if (tillgängligt === 0) return null;

  const cap = rules.longSession.capMinutesBySport[sport];
  const { maxShareOfWeek } = rules.longSession;
  const { startShareOfCap, endShareOfCap } = kurva;

  // Långpasset ska vara veckans längsta pass. Med en plats per dag (R-42) är
  // veckans tid delad på platserna vad ett vanligt pass blir, och ett
  // långpass kortare än det är precis felet från v0: där låg långpasset sist
  // i kön och blev alltid för kort.
  const snitt = slots <= 0 ? 0 : Math.ceil(budget.enduranceMinutes / slots);

  // Hur långt genom fasen veckan ligger: 1/n i första veckan, 1 i den sista.
  const iFasen = allWeeks.filter((kandidat) => kandidat.phaseId === week.phaseId);
  const position = iFasen.findIndex((kandidat) => kandidat.index === week.index) + 1;
  const andelGenomFasen = position / iFasen.length;

  // Långpasset trappas upp varje vecka genom fasen (R-13, R-46). Kurvan går
  // från sin startandel till sin slutandel — men aldrig under veckans snitt,
  // eftersom långpasset ska vara veckans längsta pass (R-42).
  //
  // Snittet är **startpunkten**, inte ett golv under kurvan. Som golv blev
  // kurvan platt tills den hann upp och hoppade sedan: långpasset mot
  // Lidingöloppet låg på 75 minuter fyra veckor i rad och gick därefter till
  // 122 på en vecka. Det är sextiotre procent, och en sådan ökning är precis
  // vad en upptrappning finns för att undvika.
  const start = Math.max(cap * startShareOfCap, snitt);
  const slut = Math.max(cap * endShareOfCap, start);
  const växande = start + (slut - start) * andelGenomFasen;

  // R-13: de sista veckorna före loppet får långpasset låna tid från de andra
  // grenarna, upp till taket i R-28. Annars binds det av grenens andel i R-08
  // och hinner aldrig bli långt nog — ett långpass på tre timmar inför 315
  // kilometer på cykel är inte en förberedelse, det är en gissning.
  // R-46: lånet följer kurvan hela fasen, inte bara de sista veckorna.
  //
  // Förut slogs det på som en knapp fyra veckor före loppet. Dessförinnan var
  // långpasset bundet av grenens egen andel i R-08 — mot Lidingöloppet låg det
  // på 75 minuter fyra veckor i rad — och när lånet slogs på hoppade det till
  // 122. Sextiotre procent på en vecka är precis vad en upptrappning finns för
  // att undvika, och löpning är den gren som sliter mest.
  //
  // Taket på 70 procent av veckan (R-28) och grenens eget tak (R-13) gäller
  // fortfarande, och de lånade minuterna tas från de övriga grenarna i
  // proportion till deras tid, så veckans totala tid är oförändrad (R-29).
  void tillgängligt;
  const grenensTid = budget.enduranceMinutes;

  // R-40: ett långpass är inget undantag från grenens golv. Ett simpass på
  // femtio minuter är lika mycket besvär att ta sig till som ett på sextio.
  //
  // Golvet gäller dessutom alla grenar veckan tränar, inte bara långpassets
  // egen: långpasset är veckans längsta pass (R-42), så ett långpass på femtio
  // minuter skulle klippa veckans simpass till femtio. Ryms inte det högsta
  // golvet blir det inget långpass, och då är inget pass bundet av det.
  const golvIVeckan = (Object.entries(budget.bySport) as [TrainedSport, number][])
    .filter(([, minuter]) => minuter > 0)
    .map(([gren]) => sessionFloor(gren));

  const golv = Math.max(
    rules.longSession.minMinutes,
    sessionFloor(sport),
    ...golvIVeckan,
  );

  // R-31: det som måste lämnas kvar till en nybörjargren dras av — men aldrig
  // så att långpasset faller under sitt eget golv. Räcker veckan inte till
  // båda behåller långpasset sin tid.
  const reserv = reservedForRequiredSports(sport, week, budget, input, races);
  const utrymme = Math.max(budget.enduranceMinutes - reserv, golv);

  const minuter = Math.min(
    Math.round(växande),
    cap,
    Math.floor(budget.enduranceMinutes * maxShareOfWeek),
    grenensTid,
    rules.session.maxMinutes,
    utrymme,
  );

  if (minuter < golv) return null;

  const dag = longSessionDate(dates, raceDates, openerDates, preferredDays);
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
function longSessionDate(
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  preferredDays: PreferredDays,
): IsoDate | null {
  const fria = dates.filter(
    (datum) =>
      !raceDates.has(datum) &&
      !openerDates.has(datum) &&
      weekdayOf(datum) !== preferredDays.rest,
  );

  const vald = fria.find((datum) => weekdayOf(datum) === preferredDays.longSession);
  if (vald !== undefined) return vald;

  // Är veckan avkortad (R-01) har den valda dagen passerat, inte blivit
  // upptagen. Då blir det inget långpass: reservdagen är veckans sista, och
  // ligger nästa veckas långpass på en måndag hamnar två långpass intill
  // varandra — vilket bryter mot R-43. Upptrappningen börjar i vecka 2.
  if (dates.length < 7) return null;

  const standard = fria.filter((datum) =>
    rules.longSession.allowedWeekdays.includes(weekdayOf(datum)),
  );

  return standard.at(-1) ?? fria.at(-1) ?? null;
}
