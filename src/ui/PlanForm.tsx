'use client';

/**
 * Formuläret i tre steg (K-02, K-03, K-04).
 *
 * All validering ligger i `form-state.ts` och går att pröva utan att rendera
 * något. Den här filen håller tillståndet, visar fälten och felen, och lämnar
 * en färdig `PlanInput` när allt stämmer.
 *
 * Felen visas vid fältet de hör till, inte som en samlad lista högst upp: det
 * ska gå att se vad som är fel utan att leta.
 */
import { useState } from 'react';
import { nextRaceDate } from '../engine/config.ts';
import type { PlanInput, Weekday } from '../engine/types.ts';
import {
  hoursRange,
  initialState,
  sportsToRate,
  toPlanInput,
  validateStep1,
  validateStep2,
  validateStep3,
  type FieldErrors,
  type FormState,
} from './form-state.ts';
import { EQUIPMENT, FORM, LEVELS, raceLabel, SPORT_NAMES, WEEKDAYS } from './texts.ts';

const STEG = 3;

interface Props {
  /** Dagens datum som ISO-sträng. Skickas in så att formuläret blir testbart. */
  today: string;
  /** Ifyllt tillstånd att börja från, för "Ändra svar" (K-13). */
  initial?: FormState | undefined;
  onSubmit: (input: PlanInput, state: FormState) => void;
}

export default function PlanForm({ today, initial, onSubmit }: Props) {
  const [state, setState] = useState<FormState>(initial ?? initialState(today));
  const [steg, setSteg] = useState(1);
  const [visaFel, setVisaFel] = useState(false);

  const fel = felFörSteg(state, steg);
  const harFel = Object.keys(fel).length > 0;

  function framåt() {
    if (harFel) {
      setVisaFel(true);
      return;
    }
    setVisaFel(false);

    if (steg < STEG) {
      setSteg(steg + 1);
      return;
    }

    const input = toPlanInput(state, today);
    if (input !== null) onSubmit(input, state);
  }

  function bakåt() {
    setVisaFel(false);
    setSteg(Math.max(1, steg - 1));
  }

  /** Visar felet för ett fält, men bara efter ett försök att gå vidare. */
  const felFör = (fält: string): string | undefined => (visaFel ? fel[fält] : undefined);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-sm font-medium text-neutral-500">{FORM.stepLabel(steg, STEG)}</p>

      {steg === 1 && <Steg1 state={state} setState={setState} felFör={felFör} />}
      {steg === 2 && <Steg2 state={state} setState={setState} felFör={felFör} />}
      {steg === 3 && <Steg3 state={state} setState={setState} felFör={felFör} />}

      <div className="mt-10 flex gap-3">
        {steg > 1 && (
          <button
            type="button"
            onClick={bakåt}
            className="rounded-lg border border-neutral-300 px-5 py-3 font-medium hover:bg-neutral-50"
          >
            {FORM.back}
          </button>
        )}
        <button
          type="button"
          onClick={framåt}
          className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700"
        >
          {steg === STEG ? FORM.submit : FORM.next}
        </button>
      </div>
    </div>
  );
}

function felFörSteg(state: FormState, steg: number): FieldErrors {
  if (steg === 1) return validateStep1(state);
  if (steg === 2) return validateStep2(state);
  return validateStep3(state);
}

interface StegProps {
  state: FormState;
  setState: (state: FormState) => void;
  felFör: (fält: string) => string | undefined;
}

/** Steg 1: loppen och deras datum (K-02). */
function Steg1({ state, setState, felFör }: StegProps) {
  function byggOm(id: string, ändring: Partial<{ selected: boolean; date: string }>) {
    setState({
      ...state,
      races: state.races.map((race) => (race.id === id ? { ...race, ...ändring } : race)),
    });
  }

  return (
    <section>
      <h2 className="mt-2 text-2xl font-bold">{FORM.step1.heading}</h2>
      <p className="mt-2 text-neutral-600">{FORM.step1.lead}</p>

      <Fält label={FORM.step1.startDateLabel} help={FORM.step1.startDateHelp} fel={felFör('startDate')}>
        <input
          type="date"
          value={state.startDate}
          onChange={(e) => setState({ ...state, startDate: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
      </Fält>

      <fieldset className="mt-8">
        <legend className="font-medium">Lopp</legend>
        {felFör('races') !== undefined && <Fel text={felFör('races') as string} />}

        <ul className="mt-3 space-y-3">
          {state.races.map((race) => (
            <li key={race.id} className="rounded-lg border border-neutral-200 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={race.selected}
                  onChange={(e) => byggOm(race.id, { selected: e.target.checked })}
                  className="mt-1 h-5 w-5"
                />
                <span className="font-medium">{raceLabel(race.id)}</span>
              </label>

              {race.selected && (
                <div className="mt-3 pl-8">
                  <label className="block text-sm text-neutral-600">
                    {FORM.step1.dateLabel}
                    <input
                      type="date"
                      value={race.date}
                      onChange={(e) => byggOm(race.id, { date: e.target.value })}
                      className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900"
                    />
                  </label>

                  {/* Arrangören har inte publicerat något datum som passar. */}
                  {nextRaceDate(race.id, state.startDate) === null && (
                    <p className="mt-2 text-sm text-neutral-600">
                      {FORM.step1.datePlaceholderMissing}
                    </p>
                  )}

                  {felFör(`date-${race.id}`) !== undefined && (
                    <Fel text={felFör(`date-${race.id}`) as string} />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </fieldset>
    </section>
  );
}

/** Steg 2: nivå per gren (K-03). */
function Steg2({ state, setState, felFör }: StegProps) {
  const grenar = sportsToRate(state);

  return (
    <section>
      <h2 className="mt-2 text-2xl font-bold">{FORM.step2.heading}</h2>
      <p className="mt-2 text-neutral-600">{FORM.step2.lead}</p>

      {felFör('levels') !== undefined && <Fel text={felFör('levels') as string} />}

      <div className="mt-6 space-y-6">
        {grenar.map((sport) => (
          <fieldset key={sport}>
            <legend className="font-medium">{SPORT_NAMES[sport]}</legend>
            <div className="mt-2 space-y-2">
              {LEVELS.map((nivå) => (
                <label
                  key={nivå.value}
                  className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3"
                >
                  <input
                    type="radio"
                    name={`level-${sport}`}
                    checked={state.levels[sport] === nivå.value}
                    onChange={() =>
                      setState({ ...state, levels: { ...state.levels, [sport]: nivå.value } })
                    }
                    className="mt-1 h-5 w-5"
                  />
                  <span>
                    <span className="font-medium">{nivå.name}</span>
                    <span className="block text-sm text-neutral-600">{nivå.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}

/** Steg 3: tid, dagar och utrustning (K-04). */
function Steg3({ state, setState, felFör }: StegProps) {
  const { min, max } = hoursRange();

  return (
    <section>
      <h2 className="mt-2 text-2xl font-bold">{FORM.step3.heading}</h2>

      <Fält label={FORM.step3.hoursLabel} help={FORM.step3.hoursHelp} fel={felFör('hoursPerWeek')}>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={state.hoursPerWeek}
          onChange={(e) => setState({ ...state, hoursPerWeek: Number(e.target.value) })}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-2"
        />
      </Fält>

      <Fält label={FORM.step3.longSessionLabel} help={FORM.step3.longSessionHelp}>
        <Dagval
          value={state.longSessionDay}
          onChange={(dag) => setState({ ...state, longSessionDay: dag })}
        />
      </Fält>

      <Fält label={FORM.step3.restLabel} help={FORM.step3.restHelp} fel={felFör('restDay')}>
        <Dagval value={state.restDay} onChange={(dag) => setState({ ...state, restDay: dag })} />
      </Fält>

      <fieldset className="mt-8">
        <legend className="font-medium">{FORM.step3.equipmentHeading}</legend>
        <p className="mt-1 text-sm text-neutral-600">{FORM.step3.equipmentHelp}</p>

        <div className="mt-3 space-y-2">
          {EQUIPMENT.map((del) => (
            <label
              key={del.key}
              className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3"
            >
              <input
                type="checkbox"
                checked={state.equipment[del.key] === true}
                onChange={(e) =>
                  setState({
                    ...state,
                    equipment: { ...state.equipment, [del.key]: e.target.checked },
                  })
                }
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="font-medium">{del.label}</span>
                <span className="block text-sm text-neutral-600">{del.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function Dagval({ value, onChange }: { value: Weekday; onChange: (dag: Weekday) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as Weekday)}
      className="rounded-lg border border-neutral-300 px-3 py-2"
    >
      {WEEKDAYS.map((dag) => (
        <option key={dag.value} value={dag.value}>
          {dag.name}
        </option>
      ))}
    </select>
  );
}

function Fält({
  label,
  help,
  fel,
  children,
}: {
  label: string;
  help?: string;
  fel?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <label className="block font-medium">{label}</label>
      {help !== undefined && <p className="mt-1 text-sm text-neutral-600">{help}</p>}
      <div className="mt-2">{children}</div>
      {fel !== undefined && <Fel text={fel} />}
    </div>
  );
}

/** Ett fel vid ett fält. `role="alert"` så att skärmläsare läser upp det. */
function Fel({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-2 text-sm font-medium text-red-700">
      {text}
    </p>
  );
}
