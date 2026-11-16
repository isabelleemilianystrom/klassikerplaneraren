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
  raceDateNotices,
  validateStep1,
  validateStep2,
  validateStep3,
  type FieldErrors,
  type FormState,
  type RaceChoice,
  latestRaceDate,
} from './form-state.ts';
import { EQUIPMENT, FORM, LEVELS, raceLabel, SPORT_NAMES, WEEKDAYS } from './texts.ts';

const STEG = 3;

interface Props {
  /** Dagens datum som ISO-sträng. Skickas in så att formuläret blir testbart. */
  today: string;
  /** Ifyllt tillstånd att börja från, för "Ändra svar" (K-13). */
  initial?: FormState | undefined;
  /** Satt när motorn inte klarade svaren. Visas vid knappen. */
  byggfel?: string | null | undefined;
  onSubmit: (input: PlanInput, state: FormState) => void;
}

export default function PlanForm({ today, initial, byggfel, onSubmit }: Props) {
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
      <Steginikator steg={steg} av={STEG} />

      {steg === 1 && <Steg1 state={state} setState={setState} felFör={felFör} />}
      {steg === 2 && <Steg2 state={state} setState={setState} felFör={felFör} />}
      {steg === 3 && <Steg3 state={state} setState={setState} felFör={felFör} />}

      {byggfel !== null && byggfel !== undefined && byggfel !== '' && (
        <p
          role="alert"
          className="mt-8 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"
        >
          {byggfel}
        </p>
      )}

      <div className="mt-10 flex gap-3">
        {steg > 1 && (
          <button
            type="button"
            onClick={bakåt}
            className="rounded-lg border border-neutral-300 px-5 py-3 font-medium hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            {FORM.back}
          </button>
        )}
        <button
          type="button"
          onClick={framåt}
          className="rounded-lg bg-neutral-900 px-5 py-3 font-medium text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
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

/**
 * Var i formuläret man är (K-02 till K-04).
 *
 * Texten "Steg 1 av 3" stod som liten grå rad och var den enda antydan om hur
 * mycket som återstod. Markörerna svarar på samma fråga utan att läsas.
 *
 * Texten står kvar som enda källa för skärmläsare: tre streck utan ord säger
 * ingenting för den som inte ser dem, och markörerna är därför `aria-hidden`.
 */
function Steginikator({ steg, av }: { steg: number; av: number }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-sm font-medium text-neutral-500">{FORM.stepLabel(steg, av)}</p>

      <div aria-hidden="true" className="flex flex-1 gap-1.5">
        {Array.from({ length: av }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i < steg ? 'bg-neutral-900' : 'bg-neutral-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Steg 1: loppen och deras datum (K-02). */
function Steg1({ state, setState, felFör }: StegProps) {
  // F-15: visas medan man skriver, inte först när man trycker på Nästa. Det
  // är ingen spärr — det är upplysningen att vi tror att loppet går en annan
  // dag, och den hjälper bara om den kommer vid datumet man just valde.
  const anmärkningar = raceDateNotices(state);

  function byggOm(
    id: string,
    ändring: Partial<{ selected: boolean; date: string; goal: RaceChoice['goal'] }>,
  ) {
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
          className="rounded-lg border border-neutral-300 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        />
      </Fält>

      <fieldset className="mt-8">
        <legend className="font-medium">Lopp</legend>
        {felFör('races') !== undefined && <Fel text={felFör('races') as string} />}

        <ul className="mt-3 space-y-3">
          {state.races.map((race) => (
            <li key={race.id} className="rounded-lg border border-neutral-200 transition-colors has-[:checked]:border-neutral-400 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900">
              {/* Etiketten täcker hela kortet, så tryckytan blir stor nog. */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg p-4 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={race.selected}
                  onChange={(e) => byggOm(race.id, { selected: e.target.checked })}
                  className="mt-1 h-5 w-5"
                />
                <span className="font-medium">{raceLabel(race.id)}</span>
              </label>

              {race.selected && (
                <div className="px-4 pb-4 pl-12">
                  <label className="block text-sm text-neutral-600">
                    {FORM.step1.dateLabel}
                    <input
                      type="date"
                      value={race.date}
                      min={state.startDate}
                      max={latestRaceDate(state.startDate) ?? undefined}
                      onChange={(e) => byggOm(race.id, { date: e.target.value })}
                      className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2.5 text-base text-neutral-900"
                    />
                  </label>

                  {/* F-15: uppmaningen att kontrollera datumet står alltid,
                      inte bara när ett datum saknas — ett fel datum som redan
                      är ifyllt är svårare att upptäcka än ett tomt fält. */}
                  <p className="mt-2 text-sm text-neutral-600">
                    {FORM.step1.dateCheckHelp}
                  </p>

                  {/* Arrangören har inte publicerat något datum som passar. */}
                  {nextRaceDate(race.id, state.startDate) === null && (
                    <p className="mt-2 text-sm text-neutral-600">
                      {FORM.step1.datePlaceholderMissing}
                    </p>
                  )}

                  {felFör(`date-${race.id}`) !== undefined && (
                    <Fel text={felFör(`date-${race.id}`) as string} />
                  )}

                  {/* F-15, andra halvan: datumet är inget av dem vi känner
                      till. En anmärkning som inte hindrar — listan slutar vid
                      2027, och den som planerar längre fram har rätt. Ett
                      felmeddelande på fältet går före: det är mer akut, och
                      två rader om samma datum är en för mycket. */}
                  {felFör(`date-${race.id}`) === undefined &&
                    anmärkningar[`date-${race.id}`] !== undefined && (
                      <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                        {anmärkningar[`date-${race.id}`]}
                      </p>
                    )}

                  {/* R-38: vad användaren vill med loppet. */}
                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-neutral-900">
                      {FORM.step1.goalLabel}
                    </legend>

                    <div className="mt-2 space-y-2">
                      {FORM.step1.goals.map((mål) => (
                        <label key={mål.value} className="flex items-start gap-3">
                          <input
                            type="radio"
                            name={`goal-${race.id}`}
                            checked={race.goal === mål.value}
                            onChange={() => byggOm(race.id, { goal: mål.value })}
                            className="mt-1 h-5 w-5"
                          />
                          <span className="text-sm">
                            <span className="font-medium">{mål.name}</span>
                            <span className="block text-neutral-600">{mål.help}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
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
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900"
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
          onChange={(e) => setState({ ...state, hoursPerWeek: e.target.value })}
          className="w-24 rounded-lg border border-neutral-300 px-3 py-2.5"
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
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900"
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
      className="rounded-lg border border-neutral-300 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
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
