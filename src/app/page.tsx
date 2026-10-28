'use client';

/**
 * Startsidan, formuläret och planen (K-01 till K-09, K-16).
 *
 * Sidan är en klientkomponent: formuläret håller tillstånd, och appen är helt
 * statisk utan server. Lagringen i webbläsaren är T-11 — just nu lever planen
 * bara så länge fliken är öppen.
 */
import { useState } from 'react';
import { buildWeekPlans, type WeekPlan } from '../engine/sessions.ts';
import { courseAdvice, midProgrammeStarts, midProgrammeWarnings } from '../engine/warnings.ts';
import { volumeChecks, volumeWarnings } from '../engine/volume.ts';
import type { PlanInput } from '../engine/types.ts';
import PlanForm from '../ui/PlanForm.tsx';
import PlanView from '../ui/PlanView.tsx';
import type { FormState } from '../ui/form-state.ts';
import { FIXED, HOME } from '../ui/texts.ts';

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
 * Samlade på ett ställe, i den ordning de bör läsas: först det som gäller
 * planens förutsättningar, sedan volymriktmärkena, sist råden om kurs.
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
  /** Formulärets tillstånd, så att "Ändra svar" kan fylla i det igen (K-13). */
  form: FormState;
}

type Vy = 'start' | 'formulär' | 'plan';

export default function Home() {
  const [vy, setVy] = useState<Vy>('start');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [today] = useState(idag);

  if (vy === 'formulär') {
    return (
      <main>
        <PlanForm
          today={today}
          initial={plan?.form}
          onSubmit={(input, form) => {
            const plans = buildWeekPlans(input);
            setPlan({ input, plans, warnings: allaVarningar(input, plans), form });
            setVy('plan');
          }}
        />
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
          onChangeAnswers={() => setVy('formulär')}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold">{HOME.title}</h1>
      <p className="mt-4 text-lg text-neutral-700">{HOME.lead}</p>
      <p className="mt-4 text-neutral-700">{HOME.body}</p>

      <p className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">{HOME.beta}</p>

      <button
        type="button"
        onClick={() => setVy('formulär')}
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
