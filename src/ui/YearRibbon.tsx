'use client';

/**
 * Planen som en stapel per vecka (designöversynen 2026-11-17).
 *
 * Komponenten tillför ingen ny data — den visar veckans minuter, samma tal som
 * redan står på varje rad. Poängen är att fyrtiofem rader inte säger att
 * programmet har en form, och att fyrtiofem staplar bredvid varandra gör det:
 * uppbyggnaden i block, avlastningsveckan sist i varje block, loppen som
 * toppar och återhämtningen som dipp efter dem.
 *
 * Skalningen ligger i `ribbonBars` och är ren, så den går att testa utan DOM.
 * Här finns bara det som kräver en webbläsare: utritningen och pekaren.
 *
 * Tillgänglighet: hela remsan har en sammanfattning i ord, och varje stapel går
 * att nå med tangentbordet och säger sin vecka, sitt datum och sin tid. Den som
 * inte ser remsan tappar ingenting — veckolistan under står kvar oförändrad.
 */
import { useState } from 'react';
import type { WeekPlan } from '../engine/sessions.ts';
import { ribbonBars } from './plan-view.ts';
import { PLAN } from './texts.ts';

interface Props {
  plans: WeekPlan[];
  /** Loppens namn i ordning, till sammanfattningen för skärmläsare. */
  raceNames: string[];
}

export default function YearRibbon({ plans, raceNames }: Props) {
  const staplar = ribbonBars(plans);
  const [aktiv, setAktiv] = useState<number | null>(null);

  if (staplar.length === 0) return null;

  const aktivStapel = staplar.find((stapel) => stapel.index === aktiv);

  return (
    <section className="mt-10" aria-labelledby="arsremsa">
      <h2 id="arsremsa" className="text-xl font-semibold tracking-tight">
        {PLAN.ribbonHeading}
      </h2>
      <p className="mt-1 text-sm text-ink-3">{PLAN.ribbonLead}</p>

      <div className="mt-4 rounded-card border border-rule bg-surface p-4">
        {/*
          Raden som visar vilken stapel man pekar på. Den har fast höjd så att
          remsan inte hoppar när texten dyker upp och försvinner.
        */}
        <p className="mb-3 h-5 text-sm font-medium text-ink-2" role="status" aria-live="off">
          {aktivStapel?.label ?? ''}
        </p>

        <ul
          className="flex h-28 items-end gap-0.5"
          aria-label={PLAN.ribbonSummary(staplar.length, raceNames)}
        >
          {staplar.map((stapel) => (
            <li key={stapel.index} className="flex h-full min-w-0 flex-1 items-end">
              <button
                type="button"
                title={stapel.label}
                onMouseEnter={() => setAktiv(stapel.index)}
                onMouseLeave={() => setAktiv(null)}
                onFocus={() => setAktiv(stapel.index)}
                onBlur={() => setAktiv(null)}
                style={{ height: `${stapel.heightPercent}%` }}
                className={`w-full rounded-t-[2px] transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none ${
                  stapel.kind === 'race'
                    ? 'bg-caution'
                    : stapel.kind === 'deload'
                      ? 'border border-b-0 border-rule-strong bg-sunk'
                      : 'bg-rule-strong'
                }`}
              >
                <span className="sr-only">{stapel.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
