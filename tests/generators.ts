/**
 * Slumpad men giltig indata till motorn (kravspecens avsnitt 9).
 *
 * Sex referensprofiler räcker inte. I v0 var det slumptestningen som avslöjade
 * att en gren aldrig tränades, och det hade P1–P5 missat. Under arbetet
 * 2026-10-29 kostade samma lucka tre fynd som alla hittades med engångsskript
 * i stället för av testsviten: P3 utan ett enda simpass i 43 veckor, P1 utan
 * kvalitetsdag i 19 veckor, och hundra minuter som försvann i en av P6:s
 * veckor.
 *
 * **Giltig betyder "det formuläret släpper igenom"**, inte "det som är
 * rimligt". Gränsen går vid `validateAll` i `src/ui/form-state.ts`: släpper
 * formuläret in indatan är det motorns sak att hantera den. Trippar en
 * invariant på något formuläret tillåter är antingen invarianten eller
 * valideringen fel — det är ett beslut per fynd, inte något generatorn kan
 * avgöra.
 *
 * **Slumpen är seedad.** Med `Math.random` blir CI instabilt och ett brott går
 * inte att återskapa. Varje indata bär sitt seed, så ett fynd kan köras om.
 */
import { raceById, races, rules } from '../src/engine/config.ts';
import { requireIsoDate } from '../src/engine/dates.ts';
import type { IsoDate, Level, PlanInput, RaceGoal, RaceId, Weekday } from '../src/engine/types.ts';

/**
 * En liten deterministisk slumpgenerator (mulberry32).
 *
 * Samma seed ger alltid samma följd. Den behöver inte vara kryptografiskt
 * stark — den ska bara vara spridd och reproducerbar.
 */
export function randomFrom(seed: number): () => number {
  let tillstånd = seed >>> 0;

  return () => {
    tillstånd = (tillstånd + 0x6d2b79f5) >>> 0;
    let t = tillstånd;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Indatan tillsammans med sitt seed, så att ett fynd går att köra om. */
export interface GeneratedInput {
  seed: number;
  input: PlanInput;
}

const NIVÅER: readonly Level[] = ['new', 'experienced', 'advanced'];
const MÅL: readonly RaceGoal[] = ['finish', 'time'];

/** Dagar i månaden som alltid finns, så inga datum blir ogiltiga. */
const SÄKRA_DAGAR = 28;

/**
 * Ett ISO-datum lagt ett antal dagar efter ett annat.
 *
 * Räknas i UTC, precis som resten av motorn, så sommartid inte flyttar ett
 * datum en dag.
 */
function dagarEfter(date: IsoDate, days: number): IsoDate {
  const tid = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return requireIsoDate(new Date(tid).toISOString().slice(0, 10), 'dagarEfter');
}

/**
 * Ett startdatum någon gång under de närmaste två åren.
 *
 * En svensk klassiker går att börja när som helst på året (R-02), så starten
 * ska spridas över alla månader — det är själva poängen med att slumpa.
 */
function startdatum(slump: () => number): IsoDate {
  const år = 2026 + Math.floor(slump() * 3);
  const månad = 1 + Math.floor(slump() * 12);
  const dag = 1 + Math.floor(slump() * SÄKRA_DAGAR);

  const text = `${år}-${String(månad).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
  return requireIsoDate(text, 'startdatum');
}

/**
 * Ett till fyra lopp med datum efter starten.
 *
 * Loppen slumpas i antal, urval, ordning och avstånd. Avstånden är med flit
 * både korta och långa: två lopp tätt ihop prövar blocklogiken i R-03, och
 * lopp långt isär prövar tolvmånadersgränsen i R-26. Båda ska planen klara.
 */
function lopp(slump: () => number, startDate: IsoDate): PlanInput['races'] {
  const alla = races.races.map((race) => race.id as RaceId);
  const blandade = [...alla].sort(() => slump() - 0.5);
  const antal = 1 + Math.floor(slump() * alla.length);
  const valda = blandade.slice(0, antal);

  // Första loppet ligger 1–40 veckor efter starten, resten 1–20 veckor efter
  // det föregående. Då blir både "hoppar in mitt i programmet" (R-35) och
  // "lopp tätt ihop" (R-03) vanliga utfall.
  //
  // Taket håller planen inom `weekTime.maxPlanWeeks` (R-01): fyra lopp med
  // det gamla spannet kunde hamna 150 veckor fram, vilket formuläret
  // underkänner — och generatorns "giltig" betyder det formuläret släpper
  // igenom, ingenting annat.
  const sistaVeckan = rules.weekTime.maxPlanWeeks - 1;
  let datum = dagarEfter(startDate, 7 * (1 + Math.floor(slump() * 40)));

  return valda.map((id, i) => {
    if (i > 0) datum = dagarEfter(datum, 7 * (1 + Math.floor(slump() * 20)));

    // Klipp vid taket: hellre två lopp samma vecka än en plan formuläret
    // aldrig hade släppt fram.
    const gräns = dagarEfter(startDate, 7 * sistaVeckan);
    if (datum > gräns) datum = gräns;

    return {
      id,
      date: datum,
      goal: MÅL[Math.floor(slump() * MÅL.length)] as RaceGoal,
    };
  });
}

/** En nivå per gren som något av loppen tränar mot — det formuläret kräver. */
function nivåer(slump: () => number, valda: PlanInput['races']): PlanInput['levels'] {
  const grenar = new Set(valda.map((race) => raceById(race.id).sport));
  const resultat: PlanInput['levels'] = {};

  for (const gren of grenar) {
    resultat[gren as 'ski'] = NIVÅER[Math.floor(slump() * NIVÅER.length)] as Level;
  }

  return resultat;
}

/** Två olika veckodagar: långpasset och vilodagen får inte krocka (K-04). */
function dagar(slump: () => number): PlanInput['preferredDays'] {
  const longSession = (1 + Math.floor(slump() * 7)) as Weekday;
  let rest = (1 + Math.floor(slump() * 7)) as Weekday;
  if (rest === longSession) rest = ((longSession % 7) + 1) as Weekday;

  return { longSession, rest };
}

/**
 * En giltig indata ur ett seed.
 *
 * Allt som varierar varieras: startmånad, antal lopp, deras ordning och
 * avstånd, målsättning per lopp, nivå per gren, timmar, dagar och utrustning.
 */
export function generateInput(seed: number): GeneratedInput {
  const slump = randomFrom(seed);

  const startDate = startdatum(slump);
  const valda = lopp(slump, startDate);

  return {
    seed,
    input: {
      schemaVersion: 5,
      today: startDate,
      startDate,
      races: valda,
      levels: nivåer(slump, valda),
      // R-41: sex timmar är golvet, femton taket.
      hoursPerWeek: 6 + Math.floor(slump() * 10),
      preferredDays: dagar(slump),
      equipment: {
        snow: slump() < 0.5,
        rollerSkis: slump() < 0.5,
        skiErg: slump() < 0.5,
        indoorTrainer: slump() < 0.5,
      },
    },
  };
}

/** `count` indata ur följden som börjar på `firstSeed`. */
export function generateInputs(count: number, firstSeed = 1): GeneratedInput[] {
  return Array.from({ length: count }, (_, i) => generateInput(firstSeed + i));
}
