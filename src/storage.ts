/**
 * Enda stället i koden som pratar med localStorage.
 *
 * Resten av appen anropar bara funktionerna här. Byts lagringen senare
 * (t.ex. mot en backend) ändras bara den här filen — signaturerna behålls.
 */
import { DISCIPLINES, type Program } from './types';

const STORAGE_KEY = 'klassikerplaneraren.program';

/**
 * Format­version som den här koden kan läsa.
 *
 * **Höj den här varje gång programobjektet byter form.** Gör man inte det
 * läses gamla program in som om de vore nya, och appen kraschar på fält som
 * inte finns — vilket är precis vad som hände när version 1 fick behålla sitt
 * nummer genom fem formatändringar.
 */
const SUPPORTED_VERSION = 2;

/** Den delmängd av Storage vi använder. Gör modulen testbar utan DOM. */
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Resultatet av att läsa sparat program.
 *
 * `discarded` skiljer "inget sparat" från "något fanns men gick inte att
 * läsa". Skillnaden spelar roll för användaren: i det andra fallet har hon
 * förlorat ett program och ska få veta det.
 */
export interface LoadedProgram {
  program: Program | null;
  discarded: boolean;
}

function getStorage(): StorageLike | null {
  try {
    // Kan kasta i privat läge eller när site data är blockerat.
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Sparar programmet. Returnerar false om lagring inte är tillgänglig. */
export function saveProgram(program: Program): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(program));
    return true;
  } catch {
    return false;
  }
}

/**
 * Läser sparat program.
 *
 * Allt som inte går att använda kastas, och det som kastades rensas direkt —
 * annars snubblar appen på samma trasiga data vid varje besök.
 */
export function loadProgram(): LoadedProgram {
  const storage = getStorage();
  if (!storage) return { program: null, discarded: false };

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { program: null, discarded: false };
  }
  if (!raw) return { program: null, discarded: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearProgram();
    return { program: null, discarded: true };
  }

  if (!isSupportedProgram(parsed)) {
    clearProgram();
    return { program: null, discarded: true };
  }

  return { program: parsed, discarded: false };
}

/** Tar bort sparat program. */
export function clearProgram(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Inget att göra: programmet finns kvar i minnet.
  }
}

/**
 * Kontrollerar att det sparade objektet går att använda.
 *
 * Vi tittar på de fält rendering och export faktiskt läser. Det är inte en
 * fullständig schemakontroll, men det fångar gamla format — och ett fält som
 * saknas här är ett fält som annars kraschar appen.
 */
function isSupportedProgram(value: unknown): value is Program {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (candidate['version'] !== SUPPORTED_VERSION) return false;
  if (!Array.isArray(candidate['weeks'])) return false;
  if (!Array.isArray(candidate['blocks'])) return false;
  if (!Array.isArray(candidate['warnings'])) return false;
  if (typeof candidate['createdAt'] !== 'string') return false;

  return hasUsableInput(candidate['input']);
}

function hasUsableInput(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;

  const objects = ['races', 'levels', 'goals', 'snowSeason', 'openWaterSeason', 'equipment', 'trainingDays'];
  for (const key of objects) {
    if (typeof input[key] !== 'object' || input[key] === null) return false;
  }

  if (typeof input['variant'] !== 'string') return false;
  if (typeof input['hoursPerWeek'] !== 'number') return false;

  // Formuläret fylls per gren, så varje gren måste finnas i alla tre.
  for (const group of ['races', 'levels', 'goals']) {
    const record = input[group] as Record<string, unknown>;
    if (DISCIPLINES.some((discipline) => record[discipline] === undefined)) return false;
  }

  return true;
}
