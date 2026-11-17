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
 *
 * **Typografin bär sidan, inte ramar** *(omgjord 2026-11-17)*. Första versionen
 * satte siffrorna i grå cirklar och ramade in listan; det gav tre element som
 * konkurrerade om uppmärksamheten på en sida vars enda uppgift är att läsas en
 * gång. Nu finns bara hårfina linjer mellan raderna, siffrorna står i egen
 * spalt i textens eget snitt, och den enda färgen på sidan är knappen.
 */
import { INTRO } from './texts.ts';

interface Props {
  onStart: () => void;
  onBack: () => void;
}

export default function Intro({ onStart, onBack }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      {/*
        Rubriken är sidans enda stora element. Tightare teckenavstånd ju större
        graden, annars glesnar den optiskt.
      */}
      <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-[-0.022em] sm:text-[2.5rem]">
        {INTRO.title}
      </h1>

      {/* Ingressen hålls på drygt fyrtio tecken — en rad att vila på, inte ett stycke. */}
      <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink-2">{INTRO.lead}</p>

      <ol className="mt-14 border-t border-rule">
        {INTRO.steps.map((steg, i) => (
          <li
            key={steg.title}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-5 border-b border-rule py-5"
          >
            {/*
              Siffran i sidans eget snitt och vikt, inte i en bricka. Den ska
              räknas, inte ropa — därför samma gråton som hjälptexten.
            */}
            <span aria-hidden="true" className="pt-0.5 text-xl text-ink-3 tabular-nums">
              {i + 1}
            </span>

            <span>
              <span className="block font-medium">{steg.title}</span>
              <span className="mt-1.5 block max-w-[52ch] text-sm leading-relaxed text-ink-3">
                {steg.body}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-12 max-w-[52ch] text-ink-2">{INTRO.after}</p>
      <p className="mt-4 max-w-[52ch] text-sm text-ink-3">{INTRO.privacy}</p>

      {/*
        En knapp, inte två. "Tillbaka" är en utväg och ska se ut som en länk —
        två lika tunga knappar tvingar fram ett val som inte finns.
      */}
      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={onStart}
          className="rounded-field bg-accent px-6 py-3 font-medium text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {INTRO.start}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-field text-sm text-ink-3 underline underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {INTRO.back}
        </button>
      </div>
    </div>
  );
}
