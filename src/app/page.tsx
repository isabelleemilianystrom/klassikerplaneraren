'use client';

/**
 * Startsidan och formuläret (K-01, K-02, K-03, K-04).
 *
 * Planvyn byggs i T-10. Tills dess visar sidan en kort bekräftelse på att
 * motorn fick indatan, så att formuläret går att pröva från början till slut.
 *
 * Sidan är en klientkomponent: formuläret håller tillstånd, och appen är helt
 * statisk utan server.
 */
import { useState } from 'react';
import PlanForm from '../ui/PlanForm.tsx';
import { buildWeekPlans } from '../engine/sessions.ts';
import { courseAdvice, midProgrammeStarts, midProgrammeWarnings } from '../engine/warnings.ts';
import { volumeChecks, volumeWarnings } from '../engine/volume.ts';
import type { PlanInput } from '../engine/types.ts';
import { FIXED, HOME } from '../ui/texts.ts';

/** Dagens datum som ISO-sträng, i användarens egen tidszon. */
function idag(): string {
  const nu = new Date();
  const år = nu.getFullYear();
  const månad = String(nu.getMonth() + 1).padStart(2, '0');
  const dag = String(nu.getDate()).padStart(2, '0');
  return `${år}-${månad}-${dag}`;
}

type Vy = 'start' | 'formulär' | 'plan';

export default function Home() {
  const [vy, setVy] = useState<Vy>('start');
  const [input, setInput] = useState<PlanInput | null>(null);
  const [today] = useState(idag);

  if (vy === 'formulär') {
    return (
      <main>
        <PlanForm
          today={today}
          onSubmit={(färdig) => {
            setInput(färdig);
            setVy('plan');
          }}
        />
      </main>
    );
  }

  if (vy === 'plan' && input !== null) {
    return (
      <main>
        <Sammanfattning input={input} onChange={() => setVy('formulär')} />
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

/**
 * En kort bekräftelse på vad motorn gjorde av svaren.
 *
 * Tillfällig: planvyn med översikt och veckovy är T-10. Den här finns för att
 * formuläret ska gå att pröva hela vägen, och visar de siffror som avgör om
 * indatan nådde fram.
 */
function Sammanfattning({ input, onChange }: { input: PlanInput; onChange: () => void }) {
  const planer = buildWeekPlans(input);
  const pass = planer.flatMap((plan) => plan.sessions).filter((s) => s.type !== 'rest');

  const varningar = [
    ...midProgrammeWarnings(midProgrammeStarts(input, planer)),
    ...volumeWarnings(volumeChecks(input, planer)),
    ...courseAdvice(input),
  ];

  const timmar = Math.round(planer.reduce((a, plan) => a + plan.totalMinutes, 0) / 60);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-bold">Ditt program är klart</h1>

      <p className="mt-4 text-neutral-700">
        {planer.length} veckor, {pass.length} pass, totalt {timmar} timmar. Första veckan börjar{' '}
        {planer[0]?.week.startDate}.
      </p>

      <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        Planvyn är inte byggd än. Det här är en kontroll av att svaren nådde fram.
      </p>

      {varningar.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold">Att tänka på</h2>
          <ul className="mt-2 space-y-3">
            {varningar.map((varning) => (
              <li key={varning} className="rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">
                {varning}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-bold">Röda flaggor</h2>
        <p className="mt-2 text-sm text-neutral-700">{FIXED.redFlags}</p>
        <p className="mt-3 text-sm text-neutral-700">{FIXED.painRule}</p>
        <p className="mt-3 text-sm text-neutral-700">{FIXED.illness}</p>
      </section>

      <button
        type="button"
        onClick={onChange}
        className="mt-10 rounded-lg border border-neutral-300 px-5 py-3 font-medium hover:bg-neutral-50"
      >
        Ändra svar
      </button>

      <div className="mt-12 space-y-3 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
        <p>{FIXED.disclaimer}</p>
        <p>{FIXED.independence}</p>
      </div>
    </div>
  );
}
