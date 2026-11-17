'use client';

/**
 * Introsidan mellan startsidan och steg 1 (K-19).
 *
 * Formuläret frågar om fyra lopp, fyra grenar, timmar, dagar och utrustning.
 * Den som trycker på knappen utan förvarning möts av det utan att veta hur
 * mycket som återstår eller om något behöver slås upp först. Den här sidan
 * svarar på tre saker innan dess: vad vi frågar om, hur lång tid det tar, och
 * att svaren går att ändra.
 *
 * Numreringen är inte dekoration — stegen *är* en ordning, och den är densamma
 * som stegindikatorn i formuläret visar.
 */
import { INTRO } from './texts.ts';

interface Props {
  onStart: () => void;
  onBack: () => void;
}

export default function Intro({ onStart, onBack }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{INTRO.title}</h1>
      <p className="mt-4 max-w-prose text-lg text-ink-2">{INTRO.lead}</p>

      <ol className="mt-10 space-y-0 border-t border-rule">
        {INTRO.steps.map((steg, i) => (
          <li
            key={steg.title}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-4 border-b border-rule py-4"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-7 items-center justify-center rounded-full bg-sunk text-sm font-semibold text-ink-3"
            >
              {i + 1}
            </span>
            <span>
              <span className="block font-medium">{steg.title}</span>
              <span className="mt-1 block max-w-prose text-sm text-ink-2">{steg.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-8 max-w-prose text-ink-2">{INTRO.after}</p>
      <p className="mt-3 max-w-prose text-sm text-ink-3">{INTRO.privacy}</p>

      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onStart}
          className="rounded-field bg-accent px-6 py-3 text-lg font-medium text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {INTRO.start}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-field px-5 py-3 font-medium text-ink-3 hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {INTRO.back}
        </button>
      </div>
    </div>
  );
}
