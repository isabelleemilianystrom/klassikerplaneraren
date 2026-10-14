import { describe, expect, it } from 'vitest';
import * as texts from './texts';

/**
 * Trasiga unicode-escapes ser ut som "l00e5ngpassen" i stället för "långpassen".
 * De uppstår när en escape-sekvens skrivs in i källkoden utan att tolkas, och
 * de syns inte förrän texten står på skärmen.
 */
const BROKEN_ESCAPE = /00[0-9a-f]{2}/i;

/** Alla strängar modulen exporterar, oavsett hur de är paketerade. */
function allStrings(): { name: string; value: string }[] {
  const found: { name: string; value: string }[] = [];

  for (const [name, exported] of Object.entries(texts)) {
    if (typeof exported === 'string') {
      found.push({ name, value: exported });
    } else if (exported !== null && typeof exported === 'object') {
      for (const [key, value] of Object.entries(exported as Record<string, unknown>)) {
        if (typeof value === 'string') found.push({ name: `${name}.${key}`, value });
      }
    }
  }

  // Texter som byggs av funktioner anropas med rimliga argument, så att även de
  // granskas. Listan måste utökas när en ny textfunktion läggs till.
  found.push({ name: 'suggestionNote', value: texts.suggestionNote('2026-10-13') });
  found.push({ name: 'suggestionResult', value: texts.suggestionResult(2, 2) });
  found.push({ name: 'suggestionResult(1)', value: texts.suggestionResult(1, 1) });
  found.push({ name: 'blockHeading', value: texts.blockHeading(0, ['Skidloppet']) });

  return found;
}

describe('texter', () => {
  it('innehåller inga trasiga unicode-escapes', () => {
    const broken = allStrings().filter(({ value }) => BROKEN_ESCAPE.test(value));
    expect(broken.map(({ name }) => name)).toEqual([]);
  });

  it('innehåller inga kvarglömda bakstreck före bokstäver', () => {
    const broken = allStrings().filter(({ value }) => /\[a-z]/i.test(value));
    expect(broken.map(({ name }) => name)).toEqual([]);
  });

  it('exporterar texter att granska', () => {
    // Skyddar testet ovan: hittar vi inga strängar granskar vi ingenting.
    expect(allStrings().length).toBeGreaterThan(40);
  });
});
