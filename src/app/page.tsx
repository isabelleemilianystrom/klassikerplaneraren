'use client';

/**
 * Startsidan, formuläret och planen (K-01 till K-10, K-13, K-15, K-16).
 *
 * Appen är helt statisk: all logik körs i webbläsaren och planen sparas i
 * localStorage. Finns en sparad plan visas den direkt vid återbesök.
 *
 * **Formuläret ritas alltid** (K-15). Går en sparad plan inte att läsa kastas
 * den, användaren får veta varför, och appen fungerar — aldrig en tom sida.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { buildWeekPlans, type WeekPlan } from '../engine/sessions.ts';
import {
  classicWindowWarnings,
  courseAdvice,
  midProgrammeStarts,
  midProgrammeWarnings,
} from '../engine/warnings.ts';
import { volumeChecks, volumeWarnings } from '../engine/volume.ts';
import type { PlanInput, TrainedSport } from '../engine/types.ts';
import { races } from '../engine/config.ts';
import Generating, { GENERATING_MS } from '../ui/Generating.tsx';
import Intro from '../ui/Intro.tsx';
import PlanForm from '../ui/PlanForm.tsx';
import PlanView from '../ui/PlanView.tsx';
import type { FormState } from '../ui/form-state.ts';
import { clear, parseStored, readRaw, save } from '../ui/storage.ts';
import { FORM, FIXED, HOME, SPORT_COLORS, SPORT_NAMES, STORAGE } from '../ui/texts.ts';

/** Dagens datum som ISO-sträng, i användarens egen tidszon. */
function idag(): string {
  const nu = new Date();
  const år = nu.getFullYear();
  const månad = String(nu.getMonth() + 1).padStart(2, '0');
  const dag = String(nu.getDate()).padStart(2, '0');
  return `${år}-${månad}-${dag}`;
}

/**
 * Varningarna om planens begränsningar (K-09).
 *
 * I den ordning de bör läsas: först planens förutsättningar, sedan
 * volymriktmärkena.
 *
 * **Kursråden ingår inte**, sedan 2026-11-17. En varning betyder "det här når
 * inte ditt mål" — ett råd om att gå en simkurs är något annat, och att visa
 * dem tillsammans gjorde att en nybörjare möttes av tre varningsmarkerade
 * rutor innan hon sett ett enda pass. De hämtas med `courseAdvice` i stället
 * och visas för sig.
 */
function allaVarningar(input: PlanInput, planer: WeekPlan[]): string[] {
  return [
    // R-26 först: ryms loppen inte i tolv månader är det inte en klassiker,
    // och det är mer grundläggande än allt annat varningarna säger.
    ...classicWindowWarnings(input),
    ...midProgrammeWarnings(midProgrammeStarts(input, planer)),
    ...volumeWarnings(volumeChecks(input, planer)),
  ];
}

interface Plan {
  input: PlanInput;
  plans: WeekPlan[];
  warnings: string[];
  /** Kursråden (R-21). Skilda från varningarna, se `allaVarningar`. */
  advice: string[];
  /** Formulärets svar, så att "Ändra svar" kan fylla i dem igen (K-13). */
  form: FormState;
}

/**
 * En plan byggd ur indata, eller null om motorn inte klarar den.
 *
 * Motorn kastar på indata den inte kan använda. Det ska aldrig hända med data
 * som passerat valideringen, men en krasch här skulle ge en tom sida — och det
 * är precis vad K-15 finns för att förhindra.
 */
function byggPlan(input: PlanInput, form: FormState): Plan | null {
  try {
    const plans = buildWeekPlans(input);
    return {
      input,
      plans,
      warnings: allaVarningar(input, plans),
      advice: courseAdvice(input),
      form,
    };
  } catch (fel) {
    // Felet loggas men sväljs. Att låta det passera vore en vit sida, och det
    // är precis vad K-15 finns för att förhindra — men ett tomt `catch` gjorde
    // felet osynligt också för den som ska rätta det. Anroparen visar ett
    // meddelande; här hamnar orsaken.
    //
    // Bara felet loggas, aldrig indatan: den är användarens svar om sin egen
    // träning och hör inte i en konsol.
    console.error('Planen kunde inte byggas:', fel);
    return null;
  }
}

type Vy = 'start' | 'intro' | 'formulär' | 'plan';

export default function Home() {
  const [today] = useState(idag);

  // Lagringen läses med useSyncExternalStore: den finns bara i webbläsaren,
  // och servern ska rendera som om ingenting vore sparat. Inga effekter, och
  // därmed inga kaskadrenderingar.
  const sparatRått = useSyncExternalStore(subscribeToStorage, readRaw, serverSnapshot);
  const sparat = useMemo(() => byggFrånLagring(sparatRått), [sparatRått]);

  // Användarens egna val väger tyngre än det sparade.
  const [eget, setEget] = useState<{ vy: Vy; plan: Plan | null } | null>(null);

  // Satt när motorn inte klarade svaren. Visas i formuläret.
  const [byggfel, setByggfel] = useState<string | null>(null);

  // K-18: planen är byggd och väntar bakom väntevyn. Se `Generating`.
  const [väntande, setVäntande] = useState<Plan | null>(null);

  useEffect(() => {
    if (väntande === null) return;

    const timer = window.setTimeout(() => {
      setEget({ vy: 'plan', plan: väntande });
      setVäntande(null);
    }, GENERATING_MS);

    // Städas om användaren hinner lämna sidan: en timer som sätter tillstånd
    // på en avmonterad vy är en läcka, inte en funktion.
    return () => window.clearTimeout(timer);
  }, [väntande]);

  const vy: Vy = eget?.vy ?? sparat.vy;
  const plan: Plan | null = eget !== null ? eget.plan : sparat.plan;
  const kastadPlan = eget === null ? sparat.discarded : null;

  function skapaPlan(input: PlanInput, form: FormState) {
    const byggd = byggPlan(input, form);

    // Klarar motorn inte svaren ska användaren få veta det. Förut returnerade
    // den här raden tyst, och knappen gjorde ingenting utan ett ord.
    if (byggd === null) {
      setByggfel(FORM.step3.errors.couldNotBuild);
      return;
    }

    setByggfel(null);

    // K-18: planen visas när väntevyn gått ut. Den är redan byggd — väntan
    // gäller bara vad som står på skärmen, aldrig om planen blir av.
    setVäntande(byggd);

    // Misslyckas lagringen fungerar appen ändå — planen finns på skärmen.
    save(input, form);
  }

  function börjaOm() {
    clear();
    setVäntande(null);
    setEget({ vy: 'formulär', plan: null });
  }

  function visaFormulär() {
    setVäntande(null);
    setEget({ vy: 'formulär', plan });
  }

  /**
   * Går från startsidan till introsidan (K-19).
   *
   * Fanns en sparad plan som inte gick att läsa rensas den här. `parseStored`
   * är ren och rensar inte själv — det ska ske när användaren gör något, inte
   * under rendering.
   */
  function börjaFrånStart() {
    if (kastadPlan !== null) clear();
    setEget({ vy: 'intro', plan: null });
  }

  // K-18: medan väntevyn visas är planen byggd men ännu inte på skärmen.
  if (väntande !== null) {
    return (
      <main>
        <Generating />
      </main>
    );
  }

  // K-19: introsidan ligger mellan startsidan och steg 1. Den visas bara på
  // vägen in första gången — "Ändra svar" och "Gör en ny plan" går direkt till
  // formuläret, eftersom den som varit där redan vet vad som frågas.
  if (vy === 'intro') {
    return (
      <main>
        <Intro
          onStart={() => setEget({ vy: 'formulär', plan: null })}
          onBack={() => setEget({ vy: 'start', plan: null })}
        />
      </main>
    );
  }

  if (vy === 'formulär') {
    return (
      <main>
        <PlanForm today={today} initial={plan?.form} byggfel={byggfel} onSubmit={skapaPlan} />
      </main>
    );
  }

  if (vy === 'plan' && plan !== null) {
    return (
      <main>
        <PlanView
          input={plan.input}
          plans={plan.plans}
          warnings={plan.warnings}
          advice={plan.advice}
          today={today}
          onChangeAnswers={visaFormulär}
          onStartOver={börjaOm}
          // K-16 gäller återbesöket: planen kom ur lagringen, inte ur
          // formuläret. En nyskapad plan börjar högst upp.
          isReturningVisit={eget === null}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
      <h1 className="text-[2.25rem] leading-[1.05] font-semibold tracking-[-0.025em] sm:text-5xl">
        {HOME.title}
      </h1>

      {/*
        Problemet som en rad, inte som en uppräkning. Loppen står i listan
        under i stället — en mening behöver inte både säga vad appen gör och
        rabbla fyra egennamn.
      */}
      <p className="mt-5 text-xl text-ink-2 sm:text-2xl">{HOME.lead}</p>

      {/*
        De fyra loppen med gren och distans, ur `races.json`. Det är sidans
        enda bild, och den är gjord av riktiga tal: nittio kilometer skidor och
        trehundrafemton på cykel säger på en gång varför ett vanligt
        träningsprogram inte räcker. Prickarna är samma grenfärger som i
        planen, så att färgerna betyder samma sak hela vägen igenom.
      */}
      <ul className="mt-12 border-t border-rule">
        {races.races.map((race) => (
          <li
            key={race.id}
            className="flex items-baseline gap-3 border-b border-rule py-3.5"
          >
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 translate-y-[-1px] rounded-full ${SPORT_COLORS[race.sport as TrainedSport].dot}`}
            />
            <span className="font-medium">{race.name}</span>
            <span className="ml-auto text-right text-sm text-ink-3 tabular-nums">
              {race.distanceKm} km {SPORT_NAMES[race.sport as TrainedSport].toLowerCase()}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-10 max-w-[56ch] text-ink-2">{HOME.body}</p>

      {/* K-15: den som hade en plan som inte gick att läsa ska få veta det. */}
      {kastadPlan !== null && (
        <p
          role="status"
          className="mt-6 border-l-2 border-caution bg-sunk px-4 py-3 text-sm text-ink-2"
        >
          {STORAGE.discarded(kastadPlan)}
        </p>
      )}

      <button
        type="button"
        onClick={börjaFrånStart}
        className="mt-8 rounded-field bg-accent px-6 py-3 text-lg font-medium text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {HOME.start}
      </button>

      {/*
        Ordningen ändrad 2026-11-16 efter designgenomgången: tre stycken
        ansvarsfriskrivning stod före knappen, alltså innan användaren fått
        veta varför appen är värd att använda. Texterna är ordagranna enligt
        avsnitt 8 och orörda — bara var de står har flyttats, och de står
        fortfarande före första klicket.
      */}
      <p className="mt-12 max-w-prose rounded-card bg-sunk px-4 py-3 text-sm text-ink-2">
        {HOME.beta}
      </p>

      <div className="mt-6 max-w-prose space-y-3 text-sm text-ink-3">
        <p>{FIXED.ageLimit}</p>
        <p>{FIXED.disclaimer}</p>
        <p>{FIXED.independence}</p>
      </div>
    </main>
  );
}

/**
 * Lagringen ändras bara av appen själv, så det finns inget att prenumerera på.
 *
 * `useSyncExternalStore` kräver ändå en prenumeration. En som aldrig anropar
 * tillbaka är rätt här: planen byts via React-tillstånd, inte via lagringen.
 */
function subscribeToStorage(): () => void {
  return () => {};
}

/** Servern har ingen lagring. Första renderingen blir alltid startsidan. */
function serverSnapshot(): string | null {
  return null;
}

/**
 * Vad den sparade datan ger: en plan, ett meddelande eller ingenting (K-15).
 *
 * Ren funktion — den anropas under rendering. Går datan inte att använda
 * kastas den här, men lagringen rensas först när användaren gör något.
 */
function byggFrånLagring(rått: string | null): {
  vy: Vy;
  plan: Plan | null;
  discarded: string | null;
} {
  const sparat = parseStored(rått);

  if (sparat.status === 'discarded') {
    return { vy: 'start', plan: null, discarded: sparat.reason };
  }
  if (sparat.status !== 'ok') {
    return { vy: 'start', plan: null, discarded: null };
  }

  const byggd = byggPlan(sparat.input, sparat.form);

  // Datan var giltig men motorn klarade den inte. Hellre startsidan med ett
  // meddelande än en tom sida.
  if (byggd === null) return { vy: 'start', plan: null, discarded: 'unusable' };

  return { vy: 'plan', plan: byggd, discarded: null };
}