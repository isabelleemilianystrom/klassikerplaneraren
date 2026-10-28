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
import { isIsoDate } from '../engine/dates.ts';
import type { PlanInput } from '../engine/types.ts';
import type { FormState } from './form-state.ts';

const KEY = 'klassikerplaneraren';

/**
 * Lagringens version. Höjs när formen på det sparade ändras.
 *
 * 1 — första versionen, med `PlanInput` i schemaVersion 2 och formulärets
 *     tillstånd.
 */
const STORAGE_VERSION = 1;

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

  const fel = validate(tolkat);
  if (fel !== null) return { status: 'discarded', reason: fel };

  const data = tolkat as Saved;
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

  if (input.schemaVersion !== 2) return false;
  if (typeof input.startDate !== 'string' || !isIsoDate(input.startDate)) return false;
  if (typeof input.today !== 'string' || !isIsoDate(input.today)) return false;

  if (!Array.isArray(input.races) || input.races.length === 0) return false;
  for (const race of input.races) {
    if (typeof race !== 'object' || race === null) return false;
    if (typeof race.id !== 'string') return false;
    if (typeof race.date !== 'string' || !isIsoDate(race.date)) return false;
  }

  if (typeof input.hoursPerWeek !== 'number' || !Number.isFinite(input.hoursPerWeek)) return false;
  if (typeof input.levels !== 'object' || input.levels === null) return false;

  if (typeof input.preferredDays !== 'object' || input.preferredDays === null) return false;
  const dagar = input.preferredDays;
  if (!isWeekday(dagar.longSession) || !isWeekday(dagar.rest)) return false;
  if (dagar.longSession === dagar.rest) return false;

  if (typeof input.equipment !== 'object' || input.equipment === null) return false;
  for (const flagga of ['snowOrRollerSkis', 'skiErg', 'pool', 'bike'] as const) {
    if (typeof input.equipment[flagga] !== 'boolean') return false;
  }

  return true;
}

/** Kontrollerar formulärets tillstånd, som "Ändra svar" fyller i från (K-13). */
function isFormState(värde: unknown): värde is FormState {
  if (typeof värde !== 'object' || värde === null) return false;
  const form = värde as Partial<FormState>;

  if (typeof form.startDate !== 'string') return false;
  if (!Array.isArray(form.races)) return false;

  for (const race of form.races) {
    if (typeof race !== 'object' || race === null) return false;
    if (typeof race.id !== 'string') return false;
    if (typeof race.selected !== 'boolean') return false;
    if (typeof race.date !== 'string') return false;
  }

  if (typeof form.hoursPerWeek !== 'number') return false;
  if (!isWeekday(form.longSessionDay) || !isWeekday(form.restDay)) return false;
  if (typeof form.levels !== 'object' || form.levels === null) return false;
  if (typeof form.equipment !== 'object' || form.equipment === null) return false;

  return true;
}

function isWeekday(värde: unknown): boolean {
  return typeof värde === 'number' && Number.isInteger(värde) && värde >= 1 && värde <= 7;
}
