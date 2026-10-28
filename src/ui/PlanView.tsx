'use client';

/**
 * Planvyn: översikt, veckovy och innevarande vecka (K-06, K-07, K-09, K-16).
 *
 * Översikten visar alla veckor grupperade i sina faser. En vecka går att öppna
 * och visar då sina sju dagar. Innevarande vecka är öppen från början och
 * markerad, så att den som kommer tillbaka ser var hon är utan att leta.
 *
 * All formatering ligger i `plan-view.ts`. Den här filen renderar.
 */
import { useEffect, useRef, useState } from 'react';
import type { WeekPlan } from '../engine/sessions.ts';
import type { IsoDate, PlanInput, Session } from '../engine/types.ts';
import { weekdayOf } from '../engine/dates.ts';
import {
  currentWeekIndex,
  formatDay,
  formatMinutes,
  formatWeekRange,
  formatZone,
  groupByPhase,
  racesInWeek,
  sessionSport,
  totalHours,
  weekFocus,
} from './plan-view.ts';
import { FIXED, PLAN } from './texts.ts';

interface Props {
  input: PlanInput;
  plans: WeekPlan[];
  warnings: string[];
  today: IsoDate;
  onChangeAnswers: () => void;
}

export default function PlanView({ input, plans, warnings, today, onChangeAnswers }: Props) {
  const aktuell = currentWeekIndex(plans, today);
  const [öppen, setÖppen] = useState<number | null>(aktuell);
  const aktuellRef = useRef<HTMLLIElement | null>(null);

  // K-16: rulla fram innevarande vecka så att den syns utan att man letar.
  useEffect(() => {
    aktuellRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const grupper = groupByPhase(plans);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header>
        <h1 className="text-3xl font-bold">{PLAN.heading}</h1>
        <p className="mt-3 text-neutral-700">
          {PLAN.summary(plans.length, totalHours(plans), input.hoursPerWeek)}
        </p>
      </header>

      {/* K-09: varningarna står överst, och planen visas ändå. */}
      {warnings.length > 0 && (
        <section className="mt-6" aria-labelledby="varningar">
          <h2 id="varningar" className="font-bold">
            {PLAN.warningsHeading}
          </h2>
          <ul className="mt-2 space-y-2">
            {warnings.map((varning) => (
              <li key={varning} className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                {varning}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm text-neutral-700">
        <h2 className="font-bold text-neutral-900">{PLAN.safetyHeading}</h2>
        <p className="mt-2">{FIXED.redFlags}</p>
        <p className="mt-2">{FIXED.painRule}</p>
        <p className="mt-2">{FIXED.illness}</p>
      </section>

      <section className="mt-10" aria-labelledby="oversikt">
        <h2 id="oversikt" className="text-xl font-bold">
          {PLAN.overviewHeading}
        </h2>

        {grupper.map((grupp) => (
          <section key={grupp.phaseId} className="mt-8">
            <h3 className="font-bold">{grupp.title}</h3>
            <p className="text-sm text-neutral-600">
              {PLAN.phaseWeeks(grupp.weeks.length)}
            </p>

            {/* K-08: fasförklaringen skrivs i T-12 och hamnar här. */}

            <ul className="mt-3 space-y-2">
              {grupp.weeks.map((plan) => (
                <Vecka
                  key={plan.week.index}
                  plan={plan}
                  öppen={öppen === plan.week.index}
                  aktuell={aktuell === plan.week.index}
                  ref={aktuell === plan.week.index ? aktuellRef : undefined}
                  onToggle={() =>
                    setÖppen(öppen === plan.week.index ? null : plan.week.index)
                  }
                />
              ))}
            </ul>
          </section>
        ))}
      </section>

      <button
        type="button"
        onClick={onChangeAnswers}
        className="mt-12 rounded-lg border border-neutral-300 px-5 py-3 font-medium hover:bg-neutral-50"
      >
        {PLAN.changeAnswers}
      </button>

      <footer className="mt-12 space-y-3 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
        <p>{FIXED.disclaimer}</p>
        <p>{FIXED.independence}</p>
      </footer>
    </div>
  );
}

interface VeckaProps {
  plan: WeekPlan;
  öppen: boolean;
  aktuell: boolean;
  ref?: React.Ref<HTMLLIElement> | undefined;
  onToggle: () => void;
}

/** En vecka i översikten, som går att öppna till en veckovy (K-06, K-07). */
function Vecka({ plan, öppen, aktuell, ref, onToggle }: VeckaProps) {
  const lopp = racesInWeek(plan);

  return (
    <li
      ref={ref}
      className={`rounded-lg border ${
        aktuell ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={öppen}
        className="flex w-full items-baseline gap-3 px-4 py-3 text-left"
      >
        <span className="w-14 shrink-0 text-sm font-medium text-neutral-500">
          {PLAN.weekNumber(plan.week.index)}
        </span>
        <span className="flex-1">
          <span className="font-medium">{formatWeekRange(plan.week.startDate)}</span>
          {aktuell && (
            <span className="ml-2 rounded bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
              {PLAN.currentWeek}
            </span>
          )}
          {plan.week.isDeload && (
            <span className="ml-2 text-xs text-neutral-600">{PLAN.deload}</span>
          )}
          {lopp.length > 0 && (
            <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
              <span aria-hidden="true">🏁</span>
              {PLAN.raceWeek(lopp)}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm text-neutral-600">
          {formatMinutes(plan.totalMinutes)}
        </span>
      </button>

      {öppen && <Veckovy plan={plan} />}
    </li>
  );
}

/** Veckans sju dagar (K-07). */
function Veckovy({ plan }: { plan: WeekPlan }) {
  const dagar = grupperaPerDag(plan.sessions);

  return (
    <div className="border-t border-neutral-200 px-4 py-3">
      <p className="text-sm text-neutral-600">{weekFocus(plan)}</p>

      <ul className="mt-3 space-y-3">
        {dagar.map(({ date, sessions }) => (
          <li key={date}>
            <p className="text-sm font-medium text-neutral-500">
              {formatDay(date, weekdayOf(date))}
            </p>

            <ul className="mt-1 space-y-2">
              {sessions.map((session) => (
                <li key={session.id} className="rounded-lg bg-white p-3 ring-1 ring-neutral-200">
                  <Pass session={session} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ett pass (K-07).
 *
 * Passtypen står först och grenen efter: raden är ett långpass, och grenen är
 * hur man väljer att göra det (R-37).
 */
function Pass({ session }: { session: Session }) {
  const gren = sessionSport(session);
  const zon = formatZone(session.zone);

  if (session.type === 'rest') {
    return <p className="text-neutral-600">{PLAN.rest}</p>;
  }

  return (
    <div>
      <p className="font-medium">
        {session.title}
        {gren !== null && <span className="font-normal text-neutral-600"> — {gren}</span>}
        <span className="ml-2 text-sm font-normal text-neutral-600">
          {formatMinutes(session.minutes)}
        </span>
      </p>

      {zon !== null && <p className="mt-1 text-sm text-neutral-600">{zon}</p>}
      <p className="mt-1 text-sm text-neutral-700">{session.instruction}</p>

      {session.alternatives.length > 0 && (
        <p className="mt-2 text-sm text-neutral-600">
          {PLAN.alternatives(
            session.alternatives.map((alternativ) =>
              alternativ.note === ''
                ? (sessionSport({ ...session, sport: alternativ.sport }) as string)
                : `${sessionSport({ ...session, sport: alternativ.sport })} (${alternativ.note})`,
            ),
          )}
        </p>
      )}

      {session.safetyNote !== undefined && (
        <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-900">{session.safetyNote}</p>
      )}
    </div>
  );
}

/** Passen grupperade per dag, i datumordning. */
function grupperaPerDag(sessions: readonly Session[]): { date: IsoDate; sessions: Session[] }[] {
  const perDag = new Map<IsoDate, Session[]>();

  for (const session of sessions) {
    const dagens = perDag.get(session.date);
    if (dagens === undefined) {
      perDag.set(session.date, [session]);
      continue;
    }
    dagens.push(session);
  }

  return [...perDag.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dagens]) => ({ date, sessions: dagens }));
}
