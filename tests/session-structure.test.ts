/**
 * Hårda passens struktur (F-10).
 *
 * Felet var att texten sa "4 × 8 minuter" på ett pass som hade tjugo. De här
 * testerna låser att texten aldrig kan begära mer tid än passet har.
 */
import { describe, expect, it } from 'vitest';
import { intervalStructure, tempoStructure } from '../src/engine/session-structure.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { rules } from '../src/engine/config.ts';
import { generateInputs } from './generators.ts';
import { PROFILES } from './profiles.ts';

/** Minuterna strukturen faktiskt beskriver. */
function summa(s: NonNullable<ReturnType<typeof tempoStructure>>): number {
  return s.warmUp + s.blocks * s.blockMinutes + (s.blocks - 1) * s.restMinutes + s.coolDown;
}

describe('F-10: passtexten ryms i passet', () => {
  it('ger exakt de tal som beslutades 2026-11-15', () => {
    // Isabelles tre exempel. Ändras skalningsregeln ska det här testet gå
    // sönder, så att ändringen blir ett beslut och inte en glidning.
    expect(tempoStructure(61)).toMatchObject({ warmUp: 10, blocks: 4, blockMinutes: 8, restMinutes: 3 });
    expect(tempoStructure(35)).toMatchObject({ warmUp: 9, blocks: 2, blockMinutes: 7, restMinutes: 3 });
    expect(tempoStructure(20)).toMatchObject({ warmUp: 5, blocks: 2, blockMinutes: 4, restMinutes: 2 });
  });

  it('beskriver alltid exakt passets längd', () => {
    for (let minuter = rules.session.minMinutes; minuter <= 180; minuter += 1) {
      const tröskel = tempoStructure(minuter);
      const intervall = intervalStructure(minuter);

      expect(tröskel, `tröskel ${minuter}`).not.toBeNull();
      expect(intervall, `intervall ${minuter}`).not.toBeNull();
      expect(summa(tröskel!), `tröskel ${minuter}`).toBe(minuter);
      expect(summa(intervall!), `intervall ${minuter}`).toBe(minuter);
    }
  });

  it('ger alltid minst två block och en rimlig uppvärmning', () => {
    for (let minuter = rules.session.minMinutes; minuter <= 180; minuter += 1) {
      for (const s of [tempoStructure(minuter), intervalStructure(minuter)]) {
        expect(s!.blocks).toBeGreaterThanOrEqual(2);
        expect(s!.warmUp).toBeGreaterThanOrEqual(rules.hardSession.minWarmUp);
        expect(s!.coolDown).toBeGreaterThanOrEqual(rules.hardSession.minWarmUp);
      }
    }
  });

  it('trappar upp antalet block när passet växer', () => {
    // Upptrappningen ur SPÅRAT-guiden, som faller ut av skalningsregeln.
    const block = [45, 55, 61, 80, 95].map((m) => tempoStructure(m)!.blocks);
    for (const [i, n] of block.entries()) {
      if (i === 0) continue;
      expect(n, `${block}`).toBeGreaterThanOrEqual(block[i - 1] as number);
    }
    expect(block.at(-1)).toBeGreaterThan(block[0] as number);
  });

  it('lämnar aldrig en platshållare i en instruktion', () => {
    const indata = [...Object.values(PROFILES), ...generateInputs(60, 1).map((x) => x.input)];

    for (const input of indata) {
      for (const plan of buildWeekPlans(input)) {
        for (const session of plan.sessions) {
          expect(session.instruction, `${session.id} ${session.type}`).not.toMatch(/\{[a-zåäö]+\}/);
        }
      }
    }
  });
});
