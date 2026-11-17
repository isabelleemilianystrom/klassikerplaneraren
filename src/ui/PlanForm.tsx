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
 *
 * **Omgjord 2026-11-17 efter designöversynen.** Val mellan två eller tre
 * jämbördiga alternativ är segmenterade kontroller i stället för staplade
 * kort, vilket halverar höjden på steg 2 och gör målvalet till en rad. Färger
 * och radier kommer ur tokens i `globals.css`.
 */
import { useRef, useState } from 'react';
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

/** Inmatningsfältens gemensamma utseende. Ett ställe, så att de inte glider isär. */
const FÄLT =
  'rounded-field border border-rule-strong bg-surface px-3 py-2.5 text-base text-ink ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

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
          className="mt-8 border-l-2 border-caution bg-sunk px-4 py-3 text-sm text-ink-2"
        >
          {byggfel}
        </p>
      )}

      {/*
        Knappraden fäster i underkanten, på alla skärmar. Den var först bara
        klibbig på telefon, men med alla fyra loppen valda är steg 1 1 625 px
        högt och "Nästa" hamnar på 1 537 px — under vikningen också på en
        laptop. Att behöva rulla för att komma vidare i ett formulär man just
        fyllt i är samma fel oavsett skärmstorlek.

        På en sida som får plats på skärmen gör `sticky` ingenting, så den
        korta första vyn påverkas inte.
      */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-10 flex gap-3 border-t border-rule bg-ground/95 px-5 py-3 backdrop-blur">
        {steg > 1 && (
          <button
            type="button"
            onClick={bakåt}
            className="rounded-field border border-rule-strong px-5 py-3 font-medium hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {FORM.back}
          </button>
        )}
        <button
          type="button"
          onClick={framåt}
          className="rounded-field bg-accent px-5 py-3 font-medium text-white hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <p className="text-sm font-medium text-ink-3">{FORM.stepLabel(steg, av)}</p>

      <div aria-hidden="true" className="flex flex-1 gap-1.5">
        {Array.from({ length: av }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < steg ? 'bg-accent' : 'bg-rule'}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Ett val mellan två eller tre jämbördiga alternativ.
 *
 * Staplade kort säger "det här är en lista att läsa igenom". En segmenterad
 * kontroll säger "välj ett av de här", vilket är sanningen — och tar en rad i
 * stället för tre eller fyra.
 *
 * Byggd på riktiga radioknappar som ligger dolda under etiketterna: då fungerar
 * piltangenter, skärmläsare och formulärsemantik utan att något behöver
 * efterliknas i kod.
 */
function Segmenterat<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T | undefined;
  options: readonly { value: T; name: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex w-full rounded-field border border-rule-strong bg-surface p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      {options.map((alternativ) => (
        <label
          key={alternativ.value}
          className={`flex-1 cursor-pointer rounded-[2px] px-3 py-2 text-center text-sm font-medium transition-colors motion-reduce:transition-none ${
            value === alternativ.value
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:bg-sunk'
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === alternativ.value}
            onChange={() => onChange(alternativ.value)}
            className="sr-only"
          />
          {alternativ.name}
        </label>
      ))}
    </div>
  );
}

/** Steg 1: loppen och deras datum (K-02). */
function Steg1({ state, setState, felFör }: StegProps) {
  // F-15: visas medan man skriver, inte först när man trycker på Nästa. Det
  // är ingen spärr — det är upplysningen att vi tror att loppet går en annan
  // dag, och den hjälper bara om den kommer vid datumet man just valde.
  const anmärkningar = raceDateNotices(state);

  /*
   * Loppet som just kryssades i, så att det som fälls ut kan rullas fram.
   *
   * Kortet växer nedåt med datum och målval, och för de lopp som ligger långt
   * ner i listan hamnade allt det utanför skärmen: man kryssade i
   * Lidingöloppet och ingenting syntes hända. Att användaren själv ska lista
   * ut att hon behöver rulla är att lägga över vårt problem på henne.
   *
   * En ref, inte ett tillstånd: rullningen hör till händelsen, inte till vad
   * formuläret innehåller, och ska inte orsaka en omrendering.
   */
  const kryssatAvAnvändaren = useRef<string | null>(null);

  /**
   * Rullar fram kortet när dess utfällda del just monterats.
   *
   * Anropas av React med elementet i samma stund det dyker upp, vilket är
   * precis rätt ögonblick — ingen gissning om när renderingen är klar.
   *
   * `nearest` rullar så lite som möjligt och gör ingenting alls när kortet
   * redan syns i sin helhet, så det första loppet i listan hoppar inte.
   * Utrymmet under kortet kommer från `scroll-mb-28`, så att den klibbiga
   * knappraden inte lägger sig över det som just visades.
   */
  function rullaFramNyttValt(id: string) {
    if (kryssatAvAnvändaren.current !== id) return;
    kryssatAvAnvändaren.current = null;

    const kort = document.getElementById(`lopp-${id}`);
    if (kort === null) return;

    const mjukt = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    kort.scrollIntoView({ block: 'nearest', behavior: mjukt ? 'smooth' : 'auto' });
  }

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
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{FORM.step1.heading}</h2>
      <p className="mt-2 max-w-prose text-ink-2">{FORM.step1.lead}</p>

      <Fält
        label={FORM.step1.startDateLabel}
        help={FORM.step1.startDateHelp}
        fel={felFör('startDate')}
      >
        <input
          type="date"
          value={state.startDate}
          onChange={(e) => setState({ ...state, startDate: e.target.value })}
          className={FÄLT}
        />
      </Fält>

      <fieldset className="mt-8">
        <legend className="font-medium">Lopp</legend>
        {felFör('races') !== undefined && <Fel text={felFör('races') as string} />}

        <ul className="mt-3 space-y-2">
          {state.races.map((race) => (
            <li
              key={race.id}
              id={`lopp-${race.id}`}
              className="scroll-mb-28 rounded-card border border-rule bg-surface transition-colors has-[:checked]:border-rule-strong has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
            >
              {/* Etiketten täcker hela kortet, så tryckytan blir stor nog. */}
              <label className="flex cursor-pointer items-start gap-3 rounded-card p-4 hover:bg-sunk">
                <input
                  type="checkbox"
                  checked={race.selected}
                  onChange={(e) => {
                    byggOm(race.id, { selected: e.target.checked });
                    // Bara när man kryssar i: att fälla ihop ska inte flytta sidan.
                    if (e.target.checked) kryssatAvAnvändaren.current = race.id;
                  }}
                  className="mt-0.5 h-5 w-5 accent-accent"
                />
                <span className="font-medium">{raceLabel(race.id)}</span>
              </label>

              {race.selected && (
                /*
                  En tunn linje i stället för ett indrag på 48 px: den binder
                  ihop innehållet med kryssrutan och sparar bredd på telefon.
                */
                <div
                  ref={(el) => {
                    if (el !== null) rullaFramNyttValt(race.id);
                  }}
                  className="mr-4 mb-4 ml-8 border-l border-rule pl-4"
                >
                  <label className="block text-sm text-ink-3">
                    {FORM.step1.dateLabel}
                    <input
                      type="date"
                      value={race.date}
                      min={state.startDate}
                      max={latestRaceDate(state.startDate) ?? undefined}
                      onChange={(e) => byggOm(race.id, { date: e.target.value })}
                      className={`mt-1 block ${FÄLT}`}
                    />
                  </label>

                  {/* F-15: uppmaningen att kontrollera datumet står alltid,
                      inte bara när ett datum saknas — ett fel datum som redan
                      är ifyllt är svårare att upptäcka än ett tomt fält. */}
                  <p className="mt-2 text-sm text-ink-3">{FORM.step1.dateCheckHelp}</p>

                  {/* Arrangören har inte publicerat något datum som passar. */}
                  {nextRaceDate(race.id, state.startDate) === null && (
                    <p className="mt-2 text-sm text-ink-3">{FORM.step1.datePlaceholderMissing}</p>
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
                      <p className="mt-2 border-l-2 border-caution bg-sunk px-3 py-2 text-sm text-ink-2">
                        {anmärkningar[`date-${race.id}`]}
                      </p>
                    )}

                  {/* R-38: vad användaren vill med loppet. */}
                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-ink">
                      {FORM.step1.goalLabel}
                    </legend>

                    <div className="mt-2">
                      <Segmenterat
                        name={`goal-${race.id}`}
                        value={race.goal}
                        options={FORM.step1.goals}
                        onChange={(mål) => byggOm(race.id, { goal: mål })}
                      />
                      <p className="mt-2 text-sm text-ink-3">
                        {FORM.step1.goals.find((mål) => mål.value === race.goal)?.help}
                      </p>
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
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{FORM.step2.heading}</h2>
      <p className="mt-2 max-w-prose text-ink-2">{FORM.step2.lead}</p>

      {felFör('levels') !== undefined && <Fel text={felFör('levels') as string} />}

      <div className="mt-6 space-y-5">
        {grenar.map((sport) => {
          const vald = LEVELS.find((nivå) => nivå.value === state.levels[sport]);

          return (
            <fieldset key={sport}>
              <legend className="font-medium">{SPORT_NAMES[sport]}</legend>

              <div className="mt-2">
                <Segmenterat
                  name={`level-${sport}`}
                  value={state.levels[sport]}
                  options={LEVELS}
                  onChange={(nivå) =>
                    setState({ ...state, levels: { ...state.levels, [sport]: nivå } })
                  }
                />

                {/*
                  Beskrivningen av den valda nivån står kvar — det är den som
                  gör svaret ärligt. Men bara den valda: tre beskrivningar
                  samtidigt var det som gjorde steget till formulärets längsta.
                */}
                <p className="mt-2 min-h-10 text-sm text-ink-3">{vald?.description ?? ''}</p>
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}

/** Steg 3: tid, dagar och utrustning (K-04). */
function Steg3({ state, setState, felFör }: StegProps) {
  const { min, max } = hoursRange();

  return (
    <section>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{FORM.step3.heading}</h2>

      <Fält label={FORM.step3.hoursLabel} help={FORM.step3.hoursHelp} fel={felFör('hoursPerWeek')}>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={state.hoursPerWeek}
          onChange={(e) => setState({ ...state, hoursPerWeek: e.target.value })}
          className={`w-24 ${FÄLT}`}
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
        <p className="mt-1 max-w-prose text-sm text-ink-3">{FORM.step3.equipmentHelp}</p>

        <div className="mt-3 space-y-2">
          {EQUIPMENT.map((del) => (
            <label
              key={del.key}
              className="flex cursor-pointer items-start gap-3 rounded-card border border-rule bg-surface p-3 hover:bg-sunk has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
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
                className="mt-0.5 h-5 w-5 accent-accent"
              />
              <span>
                <span className="font-medium">{del.label}</span>
                <span className="block text-sm text-ink-3">{del.help}</span>
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
      className={FÄLT}
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
      {help !== undefined && <p className="mt-1 max-w-prose text-sm text-ink-3">{help}</p>}
      <div className="mt-2">{children}</div>
      {fel !== undefined && <Fel text={fel} />}
    </div>
  );
}

/** Ett fel vid ett fält. `role="alert"` så att skärmläsare läser upp det. */
function Fel({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-2 text-sm font-medium text-critical">
      {text}
    </p>
  );
}
