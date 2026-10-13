/**
 * Programobjekt -> .ics (RFC 5545) för export till kalender.
 * Ren funktion, ingen DOM och inga sidoeffekter.
 */
import type { Program } from './types';

/**
 * Serialiserar programmet till en .ics-fil som text.
 *
 * TODO: inte implementerad än. Ett VEVENT per pass, UID stabilt per pass så
 * att en ny export uppdaterar istället för att dubblera händelser.
 */
export function programToIcs(_program: Program): string {
  throw new Error('ICS-exporten är inte implementerad än.');
}
