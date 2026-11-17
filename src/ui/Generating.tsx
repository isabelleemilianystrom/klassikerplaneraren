'use client';

/**
 * Väntevyn mellan formuläret och planen (K-18).
 *
 * Motorn räknar ut planen på någon millisekund, så den här vyn fyller ingen
 * teknisk funktion — den finns för att det ska synas att svaren användes.
 * Trycker man på knappen och programmet står där omedelbart ser det ut som en
 * färdig mall, inte som något som räknats ut åt en.
 *
 * **Väntan är avsiktlig.** Den visas bara när en plan just skapats, aldrig vid
 * återbesök: den som öppnar appen för att se veckans pass ska slippa den.
 *
 * Planen är redan byggd när vyn visas. Går den inte att bygga står felet i
 * formuläret direkt, utan fem sekunders väntan på ett nej.
 */
import { useEffect } from 'react';
import { GENERATING } from './texts.ts';

/**
 * Hur länge väntevyn visas.
 *
 * Fem sekunder, enligt beslutet 2026-11-16. Det är lagom för att hinna läsa
 * raden om vad som räknas ut, och kort nog att inte bli en spärr.
 */
export const GENERATING_MS = 5000;

/** Punkterna som rör sig. Dämpas för den som valt mindre rörelse. */
function Punkter() {
  return (
    <span aria-hidden="true" className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 animate-bounce rounded-full bg-rule-strong motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export default function Generating() {
  // Formuläret var rullat till steg 3 när knappen trycktes, och vyn byter inte
  // sida — utan den här raden visas väntevyn under skärmens underkant.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-2xl flex-col items-center px-5 py-24 text-center"
    >
      <Punkter />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">{GENERATING.heading}</h1>
      <p className="mt-3 max-w-prose text-ink-2">{GENERATING.body}</p>
    </div>
  );
}
