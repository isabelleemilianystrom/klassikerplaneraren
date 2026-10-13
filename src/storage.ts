/**
 * Enda stället i koden som pratar med localStorage.
 *
 * Resten av appen anropar bara funktionerna här. Byts lagringen senare
 * (t.ex. mot en backend) ändras bara den här filen — signaturerna behålls.
 */
import type { Program } from './types';

const STORAGE_KEY = 'klassikerplaneraren.program';

/** Format­version som den här koden kan läsa. */
const SUPPORTED_VERSION = 1;

/** Den delmängd av Storage vi använder. Gör modulen testbar utan DOM. */
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

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
 * Läser sparat program. Returnerar null när inget finns, när innehållet är
 * trasigt, eller när versionen är okänd — anroparen behöver inte veta vilket.
 */
export function loadProgram(): Program | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  return isSupportedProgram(parsed) ? parsed : null;
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

function isSupportedProgram(value: unknown): value is Program {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Program>;
  return candidate.version === SUPPORTED_VERSION && Array.isArray(candidate.weeks);
}
