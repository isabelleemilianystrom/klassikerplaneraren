/**
 * Passen placerade på veckans dagar (R-11, R-14, R-16, R-42, R-43).
 *
 * Motorn har redan bestämt vilka pass veckan ska ha. Den här modulen avgör
 * **vilken dag** varje pass hamnar på, och det är där reglerna om dagar i rad
 * bor: en vilodag som är helt fri, ett pass per dag, styrkan ensam, och två
 * lugna dagar efter en belastad.
 *
 * Veckorna är inte oberoende. `CarriedOver` bär det föregående veckans slut
 * behöver skicka vidare — veckogränsen är inte något reglerna känner av.
 */
import { rules } from './config.ts';
import { addDays, weekdayOf } from './dates.ts';
import { isHard } from './session-limits.ts';
import type { IsoDate, PlanInput, Session, SessionType } from './types.ts';
import type { WeekSkeleton } from './weeks.ts';
// Typimporter: de erasas vid kompilering, så ingen cirkel uppstår.
import type { PendingSession, WeekPlan } from './sessions.ts';

/**
 * Det föregående veckan behöver skicka vidare.
 *
 * R-14 och R-16 handlar båda om dagar i rad, och veckogränsen är inte något
 * reglerna känner av. Utan det här kunde söndag och måndag båda bli hårda.
 */
export interface CarriedOver {
  hardDates: ReadonlySet<IsoDate>;
  /** Dagar som bar ett hårt pass eller långpasset (R-43). */
  loadDates: ReadonlySet<IsoDate>;
  runDates: ReadonlySet<IsoDate>;
}

export const INGET_FÖRE: CarriedOver = {
  hardDates: new Set(),
  loadDates: new Set(),
  runDates: new Set(),
};

/**
 * Dagar som bär veckans belastning (R-43).
 *
 * Ett hårt pass är belastning, och långpasset är det också. Lärdomen från
 * tränargranskningen är att tre tunga dagar i en vecka tömmer depåerna även
 * när de ligger utspridda i kalendern — det räcker inte att de inte ligger i
 * rad.
 */
export function isLoadDay(session: { zone: number | null; type: SessionType }): boolean {
  if (session.type === 'race' || session.type === 'long') return session.type === 'long';
  return session.zone !== null && session.zone >= 3;
}

export function carryOver(plan: WeekPlan): CarriedOver {
  return {
    hardDates: new Set(
      plan.sessions
        .filter((session) => session.zone !== null && session.zone >= 3)
        .map((session) => session.date),
    ),
    loadDates: new Set(
      plan.sessions
        .filter((session) => isLoadDay(session))
        .map((session) => session.date),
    ),
    runDates: new Set(
      plan.sessions
        .filter((session) => session.sport === 'run' && session.type !== 'race')
        .map((session) => session.date),
    ),
  };
}

/**
 * Passen placerade på veckans dagar (R-11, R-14, R-16).
 *
 * Pass med fast dag ligger redan rätt. De övriga fördelas på veckans
 * träningsdagar, som är så många som R-11 säger och alltid lämnar minst en hel
 * vilodag. Hårda pass skiljs åt så att de aldrig ligger två dagar i rad, och
 * den som är ny i löpning får aldrig löppass två dagar i rad.
 */
export function placeOnDays(
  pending: readonly PendingSession[],
  week: WeekSkeleton,
  input: PlanInput,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  before: CarriedOver,
): Session[] {
  const perDag = new Map<IsoDate, PendingSession[]>(dates.map((datum) => [datum, []]));

  for (const session of pending) {
    if (session.fixedDate !== undefined) {
      (perDag.get(session.fixedDate) as PendingSession[]).push(session);
    }
  }

  const lediga = trainingDates(input, dates, raceDates, openerDates, perDag);
  const övriga = inConstraintOrder(pending.filter((session) => session.fixedDate === undefined));

  for (const session of övriga) {
    const dag = bestDateFor(session, lediga, perDag, input, before);

    // Saknar veckan dagar helt går passet inte att lägga. Det hände i en
    // avkortad första vecka, och resultatet var en krasch i stället för en
    // plan — det värsta möjliga utfallet (fynd F-1).
    const dagens = dag === null ? undefined : perDag.get(dag);
    if (dagens === undefined) continue;

    dagens.push(session);
  }

  return toSessions(week, dates, perDag);
}

/**
 * Veckans träningsdagar (R-11).
 *
 * Antalet styrs av T. Loppdagar och dagen före ett lopp räknas bort — de är
 * redan upptagna av regler som väger tyngre. Minst en dag lämnas helt tom.
 */
export function trainingDates(
  input: PlanInput,
  dates: readonly IsoDate[],
  raceDates: ReadonlySet<IsoDate>,
  openerDates: ReadonlySet<IsoDate>,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
): IsoDate[] {
  const önskat = trainingDayCount(input.hoursPerWeek);
  const upptagna = dates.filter((datum) => raceDates.has(datum) || openerDates.has(datum));

  const kandidater = dates.filter(
    (datum) =>
      !raceDates.has(datum) &&
      !openerDates.has(datum) &&
      weekdayOf(datum) !== input.preferredDays.rest,
  );

  // Dagar som redan bär ett fast pass, till exempel långpasset, är med.
  const redanIBruk = dates.filter(
    (datum) =>
      (perDag.get(datum)?.length ?? 0) > 0 &&
      !raceDates.has(datum) &&
      !openerDates.has(datum),
  );

  const tak = Math.max(0, dates.length - rules.trainingDays.minRestDays - upptagna.length);
  const antal = Math.min(önskat, tak);

  const valda = new Set<IsoDate>(redanIBruk);
  for (const datum of ordnadeTräningsdagar(kandidater)) {
    if (valda.size >= antal) break;
    valda.add(datum);
  }

  return dates.filter((datum) => valda.has(datum));
}

/**
 * Träningsdagarna i den ordning de tas i bruk.
 *
 * Helgen först, eftersom de längsta passen hör dit, därefter varannan vardag
 * så att passen sprids ut i stället för att klumpa ihop sig i början av veckan.
 */
function ordnadeTräningsdagar(kandidater: readonly IsoDate[]): IsoDate[] {
  const helg = kandidater.filter((datum) => weekdayOf(datum) >= 6);
  const vardag = kandidater.filter((datum) => weekdayOf(datum) < 6);

  const varannan = [
    ...vardag.filter((_, i) => i % 2 === 0),
    ...vardag.filter((_, i) => i % 2 === 1),
  ];

  return [...helg, ...varannan];
}

/** Antal träningsdagar för veckotiden (R-11). */
export function trainingDayCount(hoursPerWeek: number): number {
  const rad = rules.trainingDays.byHoursPerWeek.find((kandidat) => hoursPerWeek <= kandidat.upToHours);
  return rad?.days ?? (rules.trainingDays.byHoursPerWeek.at(-1)?.days as number);
}

/**
 * Passen i den ordning de ska få välja dag.
 *
 * Det hårt bundna passet väljer först. Ett hårt pass ska ha två lugna dagar
 * efter sig (R-43) och styrkan vill ha en egen dag (R-42), så de har bara
 * någon enstaka dag att välja mellan — medan ett lugnt pass passar nästan var
 * som helst. Får de lugna passen välja först tar de dagen det hårda behövde,
 * och då finns ingen tillåten dag kvar och regeln bryts.
 *
 * Ordningen inom varje grupp är oförändrad, så samma indata ger samma plan.
 */
function inConstraintOrder(pending: readonly PendingSession[]): PendingSession[] {
  const ordning = (session: PendingSession): number => {
    if (isLoadDay(session)) return 0;
    if (session.sport === 'strength') return 1;
    return 2;
  };

  return [...pending]
    .map((session, i) => ({ session, i }))
    .sort((a, b) => ordning(a.session) - ordning(b.session) || a.i - b.i)
    .map(({ session }) => session);
}

/**
 * Dagen som passar passet bäst (R-14, R-16).
 *
 * Reglerna rangordnas: ett hårt pass får aldrig hamna intill ett annat hårt
 * pass, och den som är ny i löpning får aldrig löpa två dagar i rad. Bland de
 * dagar som klarar det väljs den med minst tid inlagd, så att veckan blir jämn.
 */
function bestDateFor(
  session: PendingSession,
  dates: readonly IsoDate[],
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
  input: PlanInput,
  before: CarriedOver,
): IsoDate | null {
  const tillåtna = dates.filter((datum) =>
    allowedOn(session, datum, perDag, input, before),
  );
  const urval = tillåtna.length > 0 ? tillåtna : dates;
  if (urval.length === 0) return null;

  return [...urval].sort((a, b) => {
    const tidA = minutesOn(a, perDag);
    const tidB = minutesOn(b, perDag);
    return tidA === tidB ? a.localeCompare(b) : tidA - tidB;
  })[0] as IsoDate;
}

function allowedOn(
  session: PendingSession,
  date: IsoDate,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
  input: PlanInput,
  before: CarriedOver,
): boolean {
  // R-16: aldrig zon 3–4 två dagar i rad.
  if (rules.intensity.noHardDaysBackToBack && isHard(session)) {
    const hårdDag = (datum: IsoDate) =>
      before.hardDates.has(datum) || dayHas(datum, perDag, isHard);

    if (hårdDag(date) || hårdDag(addDays(date, -1)) || hårdDag(addDays(date, 1))) return false;
  }

  // R-42: styrkepasset ligger ensamt på sin dag. Ett styrkepass på tjugo
  // minuter ovanpå två löppass är inget styrkepass — och en hel timme styrka
  // förtjänar en dag.
  if (rules.strength.ownDay) {
    const ärStyrka = (kandidat: PendingSession) => kandidat.sport === 'strength';
    const dagensPass = perDag.get(date) ?? [];

    if (session.sport === 'strength' && dagensPass.length > 0) return false;
    if (session.sport !== 'strength' && dayHas(date, perDag, ärStyrka)) return false;
  }

  // R-42: ett konditionspass per dag. Appen är byggd för folk med jobb, och
  // två pass samma dag förutsätter att man kan träna två gånger.
  if (session.sport !== 'strength' && (perDag.get(date) ?? []).length > 0) return false;

  // R-43: efter ett hårt pass följer två dagar som varken bär ett hårt pass
  // eller långpasset.
  const lugnaDagar = rules.intensity.minEasyDaysAfterHard;
  if (lugnaDagar > 0 && isLoadDay(session)) {
    const belastad = (datum: IsoDate) =>
      before.loadDates.has(datum) || dayHas(datum, perDag, isLoadDay);

    if (belastad(date)) return false;
    for (let steg = 1; steg <= lugnaDagar; steg += 1) {
      if (belastad(addDays(date, -steg)) || belastad(addDays(date, steg))) return false;
    }
  }

  // R-14: nivå Ny i löpning får aldrig löppass två dagar i rad.
  if (
    rules.runVolume.noBackToBackForNewLevel &&
    session.sport === 'run' &&
    input.levels.run === 'new'
  ) {
    const ärLöpning = (kandidat: PendingSession) => kandidat.sport === 'run';
    const löpdag = (datum: IsoDate) =>
      before.runDates.has(datum) || dayHas(datum, perDag, ärLöpning);

    if (löpdag(addDays(date, -1)) || löpdag(addDays(date, 1))) return false;
  }

  return true;
}

function dayHas(
  date: IsoDate,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
  predikat: (session: PendingSession) => boolean,
): boolean {
  return (perDag.get(date) ?? []).some(predikat);
}

function minutesOn(
  date: IsoDate,
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
): number {
  return (perDag.get(date) ?? []).reduce((summa, session) => summa + session.minutes, 0);
}

/**
 * Dagarnas pass som färdiga `Session`-objekt, plus vilodagar.
 *
 * Varje dag utan pass blir ett uttalat vilopass. Vilan är en del av programmet
 * och ska stå i planen, inte vara ett hål i den.
 */
function toSessions(
  week: WeekSkeleton,
  dates: readonly IsoDate[],
  perDag: ReadonlyMap<IsoDate, readonly PendingSession[]>,
): Session[] {
  const resultat: Session[] = [];

  for (const [dagIndex, datum] of dates.entries()) {
    const dagens = perDag.get(datum) ?? [];

    if (dagens.length === 0) {
      resultat.push({
        id: `w${String(week.index).padStart(2, '0')}-d${dagIndex + 1}-1`,
        date: datum,
        sport: null,
        type: 'rest',
        minutes: 0,
        zone: null,
        title: '',
        instruction: '',
        alternatives: [],
      });
      continue;
    }

    // Längsta passet först på dagen, så att dagens tyngd syns direkt.
    const ordnade = [...dagens].sort((a, b) => b.minutes - a.minutes);

    for (const [i, session] of ordnade.entries()) {
      const färdigt: Session = {
        id: `w${String(week.index).padStart(2, '0')}-d${dagIndex + 1}-${i + 1}`,
        date: datum,
        sport: session.sport,
        type: session.type,
        minutes: session.minutes,
        zone: session.zone,
        title: '',
        instruction: '',
        alternatives: [],
      };

      // R-27: loppets id sätts bara på lopppass, så att en andra tävling samma
      // vecka går att känna igen utan att leta i titeln.
      const raceId = session.raceId;
      resultat.push(raceId === undefined ? färdigt : { ...färdigt, raceId });
    }
  }

  return resultat;
}
