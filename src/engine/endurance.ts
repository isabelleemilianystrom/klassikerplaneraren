/**
 * Veckans minuter blir pass, gren för gren (R-10, R-12, R-15, R-29, R-40, R-42).
 *
 * Budgeten säger hur många minuter varje gren får. Den här modulen gör dem
 * till pass: hur många, hur långa, vilken typ och vilken zon — och vilka
 * grenar som får stå över när veckan inte räcker till alla.
 *
 * Tre lärdomar från v0 bor här: **timmar som inte får plats ska fördelas, inte
 * försvinna**; **en gren som aldrig väljs tränas aldrig**, så urvalet roterar;
 * och **långpasset är veckans längsta pass**, så inget annat får gå om det.
 */
import { newLevelLimit, type WeekBudget } from './budget.ts';
import { raceById, rules } from './config.ts';
import {
  focusSlotsNeeded,
  focusSportOf,
  hasWeeklyRequirement,
  isHard,
  maxHardMinutes,
  maxZoneFor,
  needsTechnique,
  sessionCeiling,
  sessionFloor,
} from './session-limits.ts';
import type { Phase, PlanInput, SessionType, TrainedSport, Zone } from './types.ts';
import type { PlacedRace, WeekSkeleton } from './weeks.ts';
// Typimport: den erasas vid kompilering, så ingen cirkel uppstår.
import type { PendingSession } from './sessions.ts';

/** Styrkans pass, 20 minuter styck (R-10). */
export function strengthSessions(budget: WeekBudget): PendingSession[] {
  const längd = rules.strength.minutesPerSession;
  const antal = Math.floor(budget.strengthMinutes / längd);

  return Array.from({ length: antal }, () => ({
    sport: 'strength' as const,
    type: 'strength' as SessionType,
    minutes: längd,
    zone: null,
  }));
}

/**
 * Konditionspassen, sport för sport (R-12, R-15).
 *
 * Varje sports minuter delas i så många pass som de räcker till, med
 * `session.minMinutes` som golv. Räcker de inte till ett enda pass får sporten
 * stå över veckan, och dess minuter går till de sporter som får plats — de
 * försvinner aldrig (R-29).
 */
export function enduranceSessions(
  week: WeekSkeleton,
  budget: WeekBudget,
  input: PlanInput,
  long: PendingSession | null,
  races: readonly PlacedRace[],
  slots: number,
  fullWeek: boolean,
): PendingSession[] {
  if (slots <= 0) return [];

  const kvarPerSport = remainingBySport(budget, long);

  // R-31: taket per vecka gäller också när färre pass delar på samma tid.
  // Långpassets minuter räknas in i grenens vecka och dras av här.
  const takPerSport = new Map<TrainedSport, number>();
  for (const [sport] of kvarPerSport) {
    const gräns = newLevelLimit(sport, input);
    if (gräns === null) continue;

    const iLångpasset = long !== null && long.sport === sport ? long.minutes : 0;
    takPerSport.set(sport, Math.max(0, gräns.maxMinutesPerWeek - iLångpasset));
  }

  // R-42: kvalitetspasset ligger i veckans fokusgren. Grenen behöver då en
  // plats till det passet utöver teknikpasset (R-21) — har den bara en, och
  // den går till tekniken, finns inget hårt pass kvar att lägga.
  const fokusgren = focusSportOf(week);
  const fokusBehov = fokusgren === null ? 0 : focusSlotsNeeded(fokusgren, week, input);

  // Fokusgrenens extra platser tas från de övriga grenarna, inte från luften.
  const maxSporter = Math.max(1, slots - Math.max(0, fokusBehov - 1));

  const fördelat = foldAwayTooSmallSports(
    kvarPerSport,
    week,
    input,
    races,
    maxSporter,
    takPerSport,
  );
  // Platserna delas ut: varje gren som kom med får en, och det som blir över
  // går till grenarna med mest tid. Så blir det aldrig fler pass än dagar.
  const platsPerSport = shareSlots(fördelat, slots, fokusgren, fokusBehov);

  // Kvalitetspasset läggs bara om fokusgrenen faktiskt har en plats kvar till
  // det när teknikpasset tagit sin. Räcker veckan inte till båda går tekniken
  // före — den går inte att komma ikapp på slutet (R-21).
  const fokusHarPlats =
    fokusgren !== null && (platsPerSport.get(fokusgren) ?? 0) >= fokusBehov && fokusBehov > 0;

  // En avkortad första vecka (R-01) får inget hårt pass. Placeringen ser bara
  // bakåt, inte framåt, så ett hårt pass på stubbveckans sista dagar hamnade
  // intill nästa veckas långpass och bröt mot R-43. Kvalitetsarbetet börjar i
  // vecka 2, precis som långpasset.
  const hårda =
    fokusHarPlats && fullWeek
      ? hardSessionPlan(week, input, fokusgren as TrainedSport)
      : new Map<TrainedSport, HardSession[]>();

  const resultat: PendingSession[] = [];

  for (const [sport, minuter] of fördelat) {
    // Långpasset ska vara veckans längsta pass. Har sporten ett långpass får
    // dess övriga pass därför inte bli längre än det — annars blir "långpasset"
    // kortast av allt, vilket är precis felet från v0.
    // Långpasset är veckans längsta pass — i sin egen gren och i alla andra.
    const tak = long !== null ? long.minutes : rules.session.maxMinutes;

    // R-31: är man ny i sporten får veckan bara så många pass som taket säger.
    // En nybörjarkurs i simning är ett pass i veckan, inte två korta.
    //
    // Långpasset är redan lagt och räknas med. Är taket ett pass i veckan är
    // långpasset alltså veckans enda pass i sporten.
    const gräns = newLevelLimit(sport, input);
    const redanLagt = long !== null && long.sport === sport ? 1 : 0;
    const flestPass = Math.min(
      (gräns?.maxSessionsPerWeek ?? Number.POSITIVE_INFINITY) - redanLagt,
      platsPerSport.get(sport) ?? 0,
    );
    if (flestPass <= 0) continue;

    // R-21: ett av veckans pass i en nybörjargren blir teknikpass. Det tas
    // före de hårda passen — tekniken är det som avgör, inte intensiteten.
    let teknikKvar = needsTechnique(sport, week.phase, input)
      ? rules.technique.sessionsPerWeek
      : 0;

    for (const längd of splitIntoSessions(minuter, tak, flestPass, sport)) {
      if (teknikKvar > 0) {
        teknikKvar -= 1;
        resultat.push({ sport, type: 'technique', minutes: längd, zone: 2 });
        continue;
      }

      const hård = hårda.get(sport)?.pop();
      resultat.push({
        sport,
        type: hård?.type ?? defaultTypeFor(sport, week.phase),
        minutes: längd,
        zone: hård?.zone ?? 2,
      });
    }
  }

  return distributeLeftover(
    capHardSessions(resultat, week.phase),
    budget,
    long,
    input,
    week.phase,
  );
}

/**
 * Hårda pass kapade till fasens tak (R-15).
 *
 * Minuterna som kapas bort försvinner inte — de fördelas på veckans övriga
 * pass av `distributeLeftover` (R-29). Veckans tid är alltså oförändrad, men
 * den ligger i zon 1–2 i stället för i zon 3.
 */
function capHardSessions(
  sessions: readonly PendingSession[],
  phase: Phase,
): PendingSession[] {
  const tak = maxHardMinutes(phase);
  if (tak === null) return [...sessions];

  return sessions.map((session) => {
    if (!isHard(session) || session.minutes <= tak) return { ...session };

    // R-40 går före R-15 i en gren med eget golv. Taket på hårda minuter är
    // till för att nedtrappningen ska vara en nedtrappning, men ett simpass
    // som skärs ner till tjugo minuter är en resa till simhallen för tjugo
    // minuters träning. Passet behåller sin längd och görs lugnt i stället —
    // veckan blir inte hårdare av det, vilket är hela poängen med taket.
    if (session.sport !== 'strength' && sessionFloor(session.sport) > tak) {
      return { ...session, type: defaultTypeFor(session.sport, phase), zone: 2 as const };
    }

    return { ...session, minutes: tak };
  });
}

/**
 * Minuter som inte fick plats läggs på befintliga pass (R-29).
 *
 * Ett vanligt fall: cykeln får 319 minuter, långpasset tar sitt tak på 300 och
 * de 19 som blir kvar räcker inte till ett eget pass. De minuterna ska inte
 * försvinna — användaren har sagt vad hon kan träna, och ett program som
 * använder mindre än det ser ut att ha räknat fel.
 *
 * De läggs på det kortaste passet först, så att veckan blir jämnare och inget
 * pass växer förbi sitt tak i R-12.
 */
function distributeLeftover(
  endurance: readonly PendingSession[],
  budget: WeekBudget,
  long: PendingSession | null,
  input: PlanInput,
  fas: Phase,
): PendingSession[] {
  const resultat = endurance.map((session) => ({ ...session }));

  const planerat =
    resultat.reduce((summa, session) => summa + session.minutes, 0) + (long?.minutes ?? 0);
  let kvar = budget.enduranceMinutes - budget.unplacedMinutes - planerat;
  if (kvar <= 0 || resultat.length === 0) return resultat;

  // En minut i taget på det kortaste passet som får växa. Enkelt och alltid
  // samma resultat för samma indata.
  // R-31: ett pass i en sport man är ny i får inte växa förbi sitt veckotak.
  const taketFör = (session: PendingSession): number => {
    // R-15: ett hårt pass får inte växa tillbaka förbi fasens tak.
    const hårt = isHard(session) ? (maxHardMinutes(fas) ?? Infinity) : Infinity;
    if (session.sport === 'strength') return Math.min(rules.session.maxMinutes, hårt);

    // R-42: inget pass växer förbi långpasset — det är veckans längsta.
    const längsta = long === null || session === long ? Infinity : long.minutes;

    // R-40: ett pass växer aldrig förbi sin egen grens tak.
    const gräns = newLevelLimit(session.sport, input);
    return Math.min(
      sessionCeiling(session.sport),
      gräns?.maxMinutesPerWeek ?? Infinity,
      hårt,
      längsta,
    );
  };

  while (kvar > 0) {
    const kanVäxa = resultat.filter((session) => session.minutes < taketFör(session));
    if (kanVäxa.length === 0) break;

    const kortast = kanVäxa.reduce((a, b) => (b.minutes < a.minutes ? b : a));
    kortast.minutes += 1;
    kvar -= 1;
  }

  return resultat;
}

/**
 * Passtypen när veckan inte har något hårt pass att ge sporten (R-33).
 *
 * Under återhämtningen blir pass i en teknikgren teknikpass. Kroppen ska få
 * vila efter ett långt lopp, men tekniken tappas fort — särskilt i simning,
 * där det inte hjälper att ha cyklat. Ett teknikpass håller den uppe utan att
 * belasta.
 */
function defaultTypeFor(sport: TrainedSport, phase: Phase): SessionType {
  if (phase !== 'recovery') return 'easy';

  const teknikgrenar: readonly string[] = rules.recovery.techniqueSports;
  return teknikgrenar.includes(sport) ? 'technique' : 'easy';
}

/** Minuter per sport efter att långpasset tagit sin del. */
function remainingBySport(
  budget: WeekBudget,
  long: PendingSession | null,
): Map<TrainedSport, number> {
  const kvar = new Map<TrainedSport, number>();

  for (const [sport, minuter] of Object.entries(budget.bySport) as [TrainedSport, number][]) {
    const avdrag = long !== null && long.sport === sport ? long.minutes : 0;
    kvar.set(sport, minuter - avdrag);
  }

  // Lånade långpasset mer än sin gren hade får de andra grenarna betala, i
  // proportion till sin tid. Veckans totala tid är oförändrad.
  if (long === null) return kvar;
  const lånande = long.sport as TrainedSport;

  const lån = -Math.min(0, kvar.get(lånande) ?? 0);
  if (lån === 0) return kvar;

  kvar.set(lånande, 0);

  const övriga = [...kvar.entries()].filter(([sport]) => sport !== lånande);
  const övrigTid = övriga.reduce((summa, [, minuter]) => summa + minuter, 0);
  if (övrigTid <= 0) return kvar;

  let kvarAttTa = Math.min(lån, övrigTid);
  for (const [sport, minuter] of övriga) {
    const andel = Math.round((lån * minuter) / övrigTid);
    const tas = Math.min(andel, minuter, kvarAttTa);
    kvar.set(sport, minuter - tas);
    kvarAttTa -= tas;
  }

  // Avrundningsrest: ta den från den gren som har mest kvar.
  while (kvarAttTa > 0) {
    const störst = [...kvar.entries()]
      .filter(([sport, minuter]) => sport !== lånande && minuter > 0)
      .sort((a, b) => b[1] - a[1])[0];
    if (störst === undefined) break;

    kvar.set(störst[0], störst[1] - 1);
    kvarAttTa -= 1;
  }

  return kvar;
}

/**
 * Veckans platser fördelade på grenarna (R-42).
 *
 * En dag bär ett pass, så antalet platser är antalet dagar som är kvar. Varje
 * gren som kom med får en plats — annars hade den inte kommit med — och de
 * platser som blir över går till grenarna med mest tid. Vid lika tid avgör
 * namnet, så att samma indata alltid ger samma plan.
 */
function shareSlots(
  bySport: readonly [TrainedSport, number][],
  slots: number,
  focus: TrainedSport | null,
  focusNeeds: number,
): Map<TrainedSport, number> {
  const resultat = new Map<TrainedSport, number>(bySport.map(([sport]) => [sport, 1]));

  // Fokusgrenen får sitt behov först: en plats till teknikpasset om grenen
  // kräver det, och en till kvalitetspasset. Veckan handlar om den grenen.
  // Behovet får aldrig överskrida de platser veckan faktiskt har. I en
  // avkortad första vecka (R-01) kan en enda plats finnas, och då staplades
  // teknikpasset och kvalitetspasset på samma dag.
  const iPlanen = focus !== null && resultat.has(focus);
  if (iPlanen && focusNeeds > 1) {
    resultat.set(focus as TrainedSport, Math.max(1, Math.min(focusNeeds, slots)));
  }

  const taget = [...resultat.values()].reduce((a, b) => a + b, 0);
  let kvar = slots - taget;
  const ordnade = [...bySport].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // Varv efter varv, så att den största grenen inte tar alla platser på en gång.
  while (kvar > 0) {
    let delatUt = 0;

    for (const [sport] of ordnade) {
      if (kvar <= 0) break;
      resultat.set(sport, (resultat.get(sport) as number) + 1);
      kvar -= 1;
      delatUt += 1;
    }

    if (delatUt === 0) break;
  }

  return resultat;
}

function foldAwayTooSmallSports(
  bySport: ReadonlyMap<TrainedSport, number>,
  week: WeekSkeleton,
  input: PlanInput,
  races: readonly PlacedRace[],
  maxSports: number,
  maxBySport: ReadonlyMap<TrainedSport, number>,
): [TrainedSport, number][] {
  const alla = [...bySport.entries()].filter(([, minuter]) => minuter > 0);
  if (alla.length === 0) return [];

  const totalt = alla.reduce((summa, [, minuter]) => summa + minuter, 0);

  // Veckans fokusgren står alltid först och väljs alltid — men bara om veckans
  // tid räcker till ett helt pass i den. Gör den inte det får rotationen
  // avgöra ensam.
  const fokus =
    week.focusRaceId === null ? null : (raceById(week.focusRaceId).sport as TrainedSport);
  const fokusRad = alla.find(([sport]) => sport === fokus);
  const fokusValbar = fokusRad !== undefined && totalt >= sessionFloor(fokusRad[0]);

  // Rotationen avgör vilka av de övriga som kommer med, och den bygger på
  // veckonumret. Urvalet får inte styras av hur mycket tid grenen har: då
  // faller samma gren bort varje vecka, och en gren som aldrig tränas är
  // precis det som gick fel i v0. Simningen har minst tid och skulle alltid
  // vara den som ströks.
  const övriga = alla.filter(([sport]) => !(fokusValbar && sport === fokus));
  const start = övriga.length === 0 ? 0 : (week.index - 1) % övriga.length;
  const roterade = [...övriga.slice(start), ...övriga.slice(0, start)];

  // En gren som ska tränas varje vecka får inte kunna roteras bort, och med
  // ett högre golv (R-40) skulle den annars falla bort de veckor där
  // långpasset tagit sin del först.
  const måste = ([sport]: [TrainedSport, number]): boolean =>
    hasWeeklyRequirement(sport, week, input, races);
  const kön = roterade;

  // Varje vald gren fylls upp till ett helt pass i just den grenen. En
  // proportionell fördelning håller annars den minsta grenen liten för alltid:
  // simningen i en plan på tre timmar i veckan skulle få elva minuter, alltså
  // inget pass, hur många veckor som än gick.
  const valda: { sport: TrainedSport; minutes: number; share: number }[] = [];
  let kvar = totalt;

  const välj = (rad: [TrainedSport, number]): void => {
    const [sport, minuter] = rad;
    const golv = sessionFloor(sport);
    if (kvar < golv) return;

    // R-42: fler grenar än veckan har dagar går inte att lägga ut.
    if (valda.length >= maxSports) return;

    // R-31: taket per vecka går före golvet. Ryms inget helt pass under taket
    // tränas grenen inte den veckan.
    const tak = maxBySport.get(sport) ?? Number.POSITIVE_INFINITY;
    if (tak < golv) return;

    const tid = Math.min(Math.max(minuter, golv), kvar, tak);
    valda.push({ sport, minutes: tid, share: minuter });
    kvar -= tid;
  };

  // Grenar som ska tränas varje vecka går först — före fokusgrenen. Fokus har
  // redan veckans största andel och i de flesta veckor långpasset; det som är
  // kvar av den efter långpasset är smulor, och smulor ska inte kunna knuffa
  // bort en hel timme i en gren som annars inte blir tränad alls.
  const [måsteKö, övrigKö] = [kön.filter(måste), kön.filter((rad) => !måste(rad))];

  for (const rad of måsteKö) välj(rad);
  if (fokusValbar && fokusRad !== undefined) välj(fokusRad);
  for (const rad of övrigKö) välj(rad);

  if (valda.length === 0) return [];

  const resultat: [TrainedSport, number][] = valda.map((rad) => [rad.sport, rad.minutes]);

  // Det som är kvar fördelas i proportion till grenarnas ursprungliga tid, så
  // att veckans fokus ligger kvar där det ska.
  const över = totalt - valda.reduce((summa, rad) => summa + rad.minutes, 0);

  if (över > 0) {
    const andelar = valda.reduce((summa, rad) => summa + rad.share, 0);
    if (andelar > 0) {
      for (const [i, rad] of valda.entries()) {
        const utrad = resultat[i] as [TrainedSport, number];
        const tak = maxBySport.get(rad.sport) ?? Number.POSITIVE_INFINITY;
        utrad[1] = Math.min(utrad[1] + Math.floor((över * rad.share) / andelar), tak);
      }
    }
  }

  // Avrundningsresten läggs på den gren som har mest tid, så inget tappas.
  const summa = resultat.reduce((a, [, minuter]) => a + minuter, 0);
  const rest = totalt - summa;

  if (rest > 0) {
    // Resten går till den största grenen som har utrymme under sitt tak.
    const ordnade = [...resultat].sort((a, b) => b[1] - a[1]);
    const mottagare = ordnade.find(
      ([sport, minuter]) => minuter + rest <= (maxBySport.get(sport) ?? Number.POSITIVE_INFINITY),
    );
    if (mottagare !== undefined) mottagare[1] += rest;
  }

  return resultat;
}

/**
 * En sports minuter delade i pass som alla ligger inom R-12.
 *
 * `maxLength` är det längsta ett enskilt pass får bli. Normalt är det taket i
 * R-12, men har sporten ett långpass i veckan är det långpassets längd — inget
 * vanligt pass får bli längre än veckans långpass.
 *
 * Två pass per sport och vecka är grundregeln. Fler blir det bara när taket
 * kräver det, för fler än så gör veckan svår att överblicka.
 */
function splitIntoSessions(
  minutes: number,
  maxLength: number,
  maxSessions: number,
  sport: TrainedSport,
): number[] {
  const golv = sessionFloor(sport);
  if (minutes < golv) return [];

  const taket = Math.min(maxLength, sessionCeiling(sport));

  // Grenen använder de platser den fått, så länge varje pass håller golvet.
  // Att föreslå två långa pass när veckan har sex dagar ger ett pass på fem
  // timmar och fyra vilodagar — det hände i nedtrappningen före Vasaloppet,
  // när R-45 gav skidorna hela veckan.
  const flest = Math.min(Math.floor(minutes / golv), maxSessions);
  const antal = Math.max(1, flest);

  const grund = Math.floor(minutes / antal);
  const rest = minutes - grund * antal;
  const pass = Array.from({ length: antal }, (_, i) => grund + (i < rest ? 1 : 0));

  // Golvet och taket går inte alltid att hålla samtidigt: 106 minuter simning
  // blir antingen ett pass på 106 eller två på 53, och båda bryter en regel.
  // Då gäller taket, och de minuter som blir över går till en annan gren
  // (R-29) i stället för att bli längder ingen orkar simma.
  return pass.map((längd) => Math.min(längd, taket));
}

/** Ett hårt pass med sin zon. */
interface HardSession {
  type: SessionType;
  zone: Zone;
}

/**
 * Veckans hårda pass fördelade på sporter (R-15).
 *
 * Bas ger ett tröskelpass i zon 3. Specifik fas ger ett tröskelpass och ett
 * intervallpass i zon 4, men nivå Ny i sporten får aldrig zon 4 — tekniken
 * håller inte för den intensiteten än. Nedtrappning ger ett kort inslag i
 * zon 3 och återhämtning inget alls.
 *
 * De hårda passen går till loppets sport i första hand. Det är den sport
 * veckan handlar om.
 */
function hardSessionPlan(
  week: WeekSkeleton,
  input: PlanInput,
  sport: TrainedSport,
): Map<TrainedSport, HardSession[]> {
  const plan = new Map<TrainedSport, HardSession[]>();
  const fas = rules.intensity.byPhase[week.phase];
  if (fas.hardSessionsPerWeek === 0) return plan;

  // Utan fokuslopp finns ingen sport som veckan handlar om, och därmed inget
  // pass som ska vara hårt.
  if (week.focusRaceId === null) return plan;
  // R-15 och R-40 kan krocka: i nedtrappningen får ett hårt pass vara högst
  // tjugo minuter, och ett simpass är aldrig kortare än sextio. Då finns inget
  // hårt pass att lägga i den grenen, och veckan får inget — kvalitetspasset
  // ligger i fokusgrenen eller ingen alls.
  const tak = maxHardMinutes(week.phase);
  if (tak !== null && sessionFloor(sport) > tak) return plan;

  const maxZone = maxZoneFor(week.phase, input.levels[sport]);
  const hårda: HardSession[] = [];

  // Intervallpasset först där zonen tillåter det: räcker veckan till ett enda
  // hårt pass ska det vara intervallerna — en dag i veckan ska vara
  // intervaller (R-42). Tröskelpasset i zon 3 är det hårda passet i
  // grundperioden, där zon 4 inte hör hemma än.
  if (maxZone >= 4) hårda.push({ type: 'intervals', zone: 4 });
  if (maxZone >= 3) hårda.push({ type: 'tempo', zone: 3 });

  plan.set(sport, hårda.slice(0, fas.hardSessionsPerWeek));
  return plan;
}
