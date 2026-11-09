/**
 * Lagring i webbläsaren (K-10, K-15).
 *
 * Bara den här modulen rör `localStorage`. Resten av koden ber om att få spara
 * eller läsa, och får ett svar som alltid går att använda.
 *
 * **Lärdomen från v0:** formatet ändrades fem gånger under samma versionsnummer,
 * och resultatet blev en vit sida för alla som hade ett sparat program. Därför:
 *
 * - `STORAGE_VERSION` höjs varje gång formen ändras, och äldre data kastas.
 * - Allt som läses valideras innan det används — inte bara versionsnumret.
 * - Allt sker i try/catch. Privat läge, full disk och avstängda kakor ska ge
 *   en app som fungerar, inte en krasch.
 * - Går något fel kastas datan, lagringen rensas och användaren får veta varför.
 *   **Men formuläret ritas alltid.**
 */
import { races } from '../engine/config.ts';
import { isIsoDate } from '../engine/dates.ts';
import type { PlanInput } from '../engine/types.ts';
import { hoursRange, type FormState } from './form-state.ts';

const KEY = 'klassikerplaneraren';

/**
 * Lagringens version. Höjs när formen på det sparade ändras.
 *
 * 1 — första versionen, med `PlanInput` i schemaVersion 2.
 * 2 — målsättning per lopp (R-38). `PlanInput` är nu schemaVersion 3.
 * 3 — utrustningen är bara komplementen: simhall och cykel utgick, snö blev
 *     en fråga om månaden (R-17, R-20). `PlanInput` är nu schemaVersion 4.
 * 4 — snötillgången tillbaka som eget fält: snö kräver både vintermånad och
 *     ett spår att åka i (R-17). `PlanInput` är nu schemaVersion 5.
 */
export const STORAGE_VERSION = 5;

/** Det som sparas. Planen räknas om vid inläsning, den sparas inte. */
interface Saved {
  storageVersion: number;
  input: PlanInput;
  form: FormState;
}

/** Vad en inläsning gav. */
export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; input: PlanInput; form: FormState }
  | { status: 'discarded'; reason: string };

/** Sant när webbläsaren har en fungerande localStorage. */
function available(): boolean {
  try {
    if (typeof window === 'undefined' || window.localStorage === undefined) return false;

    // Privat läge i vissa webbläsare låter en läsa men inte skriva.
    const prov = `${KEY}-prov`;
    window.localStorage.setItem(prov, '1');
    window.localStorage.removeItem(prov);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sparar planens indata och formulärets svar.
 *
 * Returnerar sant när det lyckades. Misslyckas det är det inte ett fel som ska
 * stoppa något: användaren har sin plan på skärmen, den finns bara inte kvar
 * till nästa gång.
 */
export function save(input: PlanInput, form: FormState): boolean {
  if (!available()) return false;

  try {
    const data: Saved = { storageVersion: STORAGE_VERSION, input, form };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    // Full disk, kvot överskriden, eller något annat vi inte rår över.
    return false;
  }
}

/**
 * Läser den sparade planen (K-15).
 *
 * Allt som inte går att använda kastas, och lagringen rensas. Anroparen ritar
 * formuläret oavsett vad som returneras.
 */
export function load(): LoadResult {
  const resultat = parseStored(readRaw());

  // Kastas något rensas lagringen här. `parseStored` är ren och gör det inte
  // själv, eftersom den anropas under rendering.
  if (resultat.status === 'discarded') clear();

  return resultat;
}

/**
 * Den råa strängen i lagringen, eller null.
 *
 * Säker att anropa under rendering: inga sidoeffekter, inga undantag.
 */
export function readRaw(): string | null {
  if (!available()) return null;

  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Tolkar och validerar en rå sträng ur lagringen (K-15).
 *
 * Ren funktion: den rensar inte och skriver inte. Det gör `load`, som bara
 * anropas utanför rendering. Data som kastas här ligger kvar tills nästa
 * sparning skriver över den — den valideras ändå varje gång.
 */
export function parseStored(rått: string | null): LoadResult {
  if (rått === null) return { status: 'empty' };

  let tolkat: unknown;
  try {
    tolkat = JSON.parse(rått);
  } catch {
    return { status: 'discarded', reason: 'unreadable' };
  }

  const uppgraderat = upgrade(tolkat);

  const fel = validate(uppgraderat);
  if (fel !== null) return { status: 'discarded', reason: fel };

  const data = uppgraderat as Saved;
  return { status: 'ok', input: data.input, form: data.form };
}

/** Rensar lagringen. */
export function clear(): void {
  if (!available()) return;

  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Går det inte att rensa går det inte. Nästa inläsning kastar den igen.
  }
}

/**
 * Kontrollerar att det inlästa går att använda, eller säger varför inte.
 *
 * Kontrollen tittar på **de fält som faktiskt används**, inte bara på
 * versionsnumret. Det var precis det v0 gjorde fel: versionen stämde, formen
 * gjorde det inte, och appen kraschade på första renderingen.
 */
/**
 * Lyfter äldre sparad data till den form vi läser i dag.
 *
 * Version 4 höll formulärets timmar som ett tal; version 5 håller dem som
 * text. Det är hela skillnaden, och att kasta hela planen för den skull vore
 * att straffa användaren för en ändring i formuläret. Går uppgraderingen inte
 * att göra returneras datan orörd, och valideringen kastar den som vanligt.
 */
function upgrade(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;

  const sparat = data as Partial<Saved> & { form?: { hoursPerWeek?: unknown } };
  if (sparat.storageVersion !== 4) return data;

  const timmar = sparat.form?.hoursPerWeek;
  if (typeof timmar !== 'number' || !Number.isInteger(timmar)) return data;

  return {
    ...sparat,
    storageVersion: STORAGE_VERSION,
    form: { ...sparat.form, hoursPerWeek: String(timmar) },
  };
}

function validate(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'unreadable';

  const sparat = data as Partial<Saved>;

  if (sparat.storageVersion !== STORAGE_VERSION) return 'old-version';
  if (!isPlanInput(sparat.input)) return 'bad-input';
  if (!isFormState(sparat.form)) return 'bad-form';

  return null;
}

/** Kontrollerar att indatan har den form motorn kräver. */
function isPlanInput(värde: unknown): värde is PlanInput {
  if (typeof värde !== 'object' || värde === null) return false;
  const input = värde as Partial<PlanInput>;

  if (input.schemaVersion !== 5) return false;
  if (typeof input.startDate !== 'string' || !isIsoDate(input.startDate)) return false;
  if (typeof input.today !== 'string' || !isIsoDate(input.today)) return false;

  if (!Array.isArray(input.races) || input.races.length === 0) return false;

  // Ett okänt id gör att motorn kastar när planen byggs. Hellre kasta den
  // sparade planen här och visa "kunde inte öppnas" än ett byggfel senare.
  const kända = new Set(races.races.map((race) => race.id));
  const sedda = new Set<string>();

  for (const race of input.races) {
    if (typeof race !== 'object' || race === null) return false;
    if (typeof race.id !== 'string' || !kända.has(race.id as never)) return false;
    if (typeof race.date !== 'string' || !isIsoDate(race.date)) return false;
    if (race.goal !== 'finish' && race.goal !== 'time') return false;

    // Högst ett lopp per gren. Formuläret kan inte skapa dubbletter, och de
    // skulle ge en plan med samma lopp två gånger.
    if (sedda.has(race.id)) return false;
    sedda.add(race.id);
  }

  // R-41: heltal inom intervallet, inte bara ett tal. En handskriven
  // `hoursPerWeek: 1000000` gav sextio miljoner minuter att dela ut per vecka
  // och låste webbläsaren.
  if (typeof input.hoursPerWeek !== 'number' || !Number.isInteger(input.hoursPerWeek)) return false;
  const timmar = hoursRange();
  if (input.hoursPerWeek < timmar.min || input.hoursPerWeek > timmar.max) return false;
  if (!ärNivåer(input.levels)) return false;

  if (typeof input.preferredDays !== 'object' || input.preferredDays === null) return false;
  const dagar = input.preferredDays;
  if (!isWeekday(dagar.longSession) || !isWeekday(dagar.rest)) return false;
  if (dagar.longSession === dagar.rest) return false;

  if (typeof input.equipment !== 'object' || input.equipment === null) return false;
  for (const flagga of ['snow', 'rollerSkis', 'skiErg', 'indoorTrainer'] as const) {
    if (typeof input.equipment[flagga] !== 'boolean') return false;
  }

  return true;
}

/** Kontrollerar formulärets tillstånd, som "Ändra svar" fyller i från (K-13). */
function isFormState(värde: unknown): värde is FormState {
  if (typeof värde !== 'object' || värde === null) return false;
  const form = värde as Partial<FormState>;

  // Lika strängt som `isPlanInput`: samma data, samma krav. Tomt datum är
  // dock giltigt i formuläret — ett lopp som inte är valt har inget datum än.
  if (typeof form.startDate !== 'string' || !ärDatumEllerTomt(form.startDate)) return false;
  if (!Array.isArray(form.races)) return false;

  for (const race of form.races) {
    if (typeof race !== 'object' || race === null) return false;
    if (typeof race.id !== 'string') return false;
    if (typeof race.selected !== 'boolean') return false;
    if (typeof race.date !== 'string' || !ärDatumEllerTomt(race.date)) return false;
    if (race.goal !== 'finish' && race.goal !== 'time') return false;
  }

  if (typeof form.hoursPerWeek !== 'string') return false;
  if (!isWeekday(form.longSessionDay) || !isWeekday(form.restDay)) return false;
  if (!ärNivåer(form.levels)) return false;
  if (typeof form.equipment !== 'object' || form.equipment === null) return false;

  return true;
}

/**
 * Sant för ett objekt där varje nyckel är en gren och varje värde en nivå.
 *
 * Förut kontrollerades bara att det *var* ett objekt, så `{ ski: 'banan' }`
 * gick igenom. Ett okänt värde beter sig som "inte nybörjare" i motorn och ger
 * en plan som ser riktig ut men inte är det användaren svarade.
 */
function ärNivåer(värde: unknown): boolean {
  if (typeof värde !== 'object' || värde === null) return false;

  const grenar: readonly string[] = ['ski', 'bike', 'swim', 'run'];
  const nivåer: readonly string[] = ['new', 'experienced', 'advanced'];

  for (const [gren, nivå] of Object.entries(värde)) {
    if (!grenar.includes(gren)) return false;
    if (typeof nivå !== 'string' || !nivåer.includes(nivå)) return false;
  }

  return true;
}

/** Sant för ett ISO-datum eller tom sträng — ett lopp utan valt datum. */
function ärDatumEllerTomt(värde: string): boolean {
  return värde === '' || isIsoDate(värde);
}

function isWeekday(värde: unknown): boolean {
  return typeof värde === 'number' && Number.isInteger(värde) && värde >= 1 && värde <= 7;
}
