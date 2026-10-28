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
import { useMemo, useState, useSyncExternalStore } from 'react';
import { buildWeekPlans, type WeekPlan } from '../engine/sessions.ts';
import { courseAdvice, midProgrammeStarts, midProgrammeWarnings } from '../engine/warnings.ts';
import { volumeChecks, volumeWarnings } from '../engine/volume.ts';
import type { PlanInput } from '../engine/types.ts';
import PlanForm from '../ui/PlanForm.tsx';
import PlanView from '../ui/PlanView.tsx';
import type { FormState } from '../ui/form-state.ts';
import { clear, parseStored, readRaw, save } from '../ui/storage.ts';
import { FIXED, HOME, STORAGE } from '../ui/texts.ts';

/** Dagens datum som ISO-sträng, i användarens egen tidszon. */
function idag(): string {
  const nu = new Date();
  const år = nu.getFullYear();
  const månad = String(nu.getMonth() + 1).padStart(2, '0');
  const dag = String(nu.getDate()).padStart(2, '0');
  return `${år}-${månad}-${dag}`;
}

/**
 * Alla varningar och råd som hör till planen (K-09).
 *
 * I den ordning de bör läsas: först planens förutsättningar, sedan
 * volymriktmärkena, sist råden om kurs.
 */
function allaVarningar(input: PlanInput, planer: WeekPlan[]): string[] {
  return [
    ...midProgrammeWarnings(midProgrammeStarts(input, planer)),
    ...volumeWarnings(volumeChecks(input, planer)),
    ...courseAdvice(input),
  ];
}

interface Plan {
  input: PlanInput;
  plans: WeekPlan[];
  warnings: string[];
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
    return { input, plans, warnings: allaVarningar(input, plans), form };
  } catch {
    return null;
  }
}

type Vy = 'start' | 'formulär' | 'plan';

export default function Home() {
  const [today] = useState(idag);

  // Lagringen läses med useSyncExternalStore: den finns bara i webbläsaren,
  // och servern ska rendera som om ingenting vore sparat. Inga effekter, och
  // därmed inga kaskadrenderingar.
  const sparatRått = useSyncExternalStore(subscribeToStorage, readRaw, serverSnapshot);
  const sparat = useMemo(() => byggFrånLagring(sparatRått), [sparatRått]);

  // Användarens egna val väger tyngre än det sparade.
  const [eget, setEget] = useState<{ vy: Vy; plan: Plan | null } | null>(null);

  const vy: Vy = eget?.vy ?? sparat.vy;
  const plan: Plan | null = eget !== null ? eget.plan : sparat.plan;
  const kastadPlan = eget === null ? sparat.discarded : null;

  function skapaPlan(input: PlanInput, form: FormState) {
    const byggd = byggPlan(input, form);
    if (byggd === null) return;

    setEget({ vy: 'plan', plan: byggd });
    // Misslyckas lagringen fungerar appen ändå — planen finns på skärmen.
    save(input, form);
  }

  function börjaOm() {
    clear();
    setEget({ vy: 'formulär', plan: null });
  }

  function visaFormulär() {
    setEget({ vy: 'formulär', plan });
  }

  /**
   * Startar formuläret från startsidan.
   *
   * Fanns en sparad plan som inte gick att läsa rensas den här. `parseStored`
   * är ren och rensar inte själv — det ska ske när användaren gör något, inte
   * under rendering.
   */
  function börjaFrånStart() {
    if (kastadPlan !== null) clear();
    setEget({ vy: 'formulär', plan: null });
  }

  if (vy === 'formulär') {
    return (
      <main>
        <PlanForm today={today} initial={plan?.form} onSubmit={skapaPlan} />
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
          today={today}
          onChangeAnswers={visaFormulär}
          onStartOver={börjaOm}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold">{HOME.title}</h1>
      <p className="mt-4 text-lg text-neutral-700">{HOME.lead}</p>
      <p className="mt-4 text-neutral-700">{HOME.body}</p>

      {/* K-15: den som hade en plan som inte gick att läsa ska få veta det. */}
      {kastadPlan !== null && (
        <p role="status" className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          {STORAGE.discarded(kastadPlan)}
        </p>
      )}

      <p className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">{HOME.beta}</p>

      <button
        type="button"
        onClick={börjaFrånStart}
        className="mt-8 rounded-lg bg-neutral-900 px-6 py-3 text-lg font-medium text-white hover:bg-neutral-700"
      >
        {HOME.start}
      </button>

      {/* Texterna i avsnitt 8 används ordagrant. */}
      <div className="mt-12 space-y-3 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
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