'use client';

/**
 * Planvyn: översikt, veckovy och innevarande vecka (K-06, K-07, K-09, K-16).
 *
 * Översikten visar alla veckor grupperade i sina faser. En vecka går att öppna
 * och visar då sina sju dagar. Innevarande vecka är öppen från början och
 * markerad, så att den som kommer tillbaka ser var hon är utan att leta.
 *
 * All formatering ligger i `plan-view.ts`. Den här filen renderar.
 *
 * **Omgjord 2026-11-17 efter designöversynen.** Veckoraden var ett kort med ram
 * bland fyrtiofyra likadana kort; nu är den en rad i en lista, med veckans
 * belastning som en stapel och lopp och avlastning som chips. Färger och radier
 * kommer ur tokens i `globals.css` i stället för ur lösa verktygsklasser.
 */
import { useEffect, useRef, useState } from 'react';
import type { WeekPlan } from '../engine/sessions.ts';
import type { IsoDate, PlanInput, Session } from '../engine/types.ts';
import { weekdayOf } from '../engine/dates.ts';
import {
  currentWeek,
  currentWeekIndex,
  formatDay,
  formatMinutes,
  formatWeekRange,
  formatZone,
  groupByPhase,
  hasWeekStarted,
  racesInWeek,
  ribbonBars,
  sessionSport,
  shouldScrollToCurrentWeek,
  totalHours,
  weekFocus,
} from './plan-view.ts';
import { explanations, raceById } from '../engine/config.ts';
import { FIXED, PLAN, SPORT_COLORS, STORAGE } from './texts.ts';
import YearRibbon from './YearRibbon.tsx';

interface Props {
  input: PlanInput;
  plans: WeekPlan[];
  warnings: string[];
  /** Kursråden (R-21). Visas för sig, inte som varningar. */
  advice: string[];
  today: IsoDate;
  onChangeAnswers: () => void;
  onStartOver: () => void;
  /**
   * Sant när planen lästes ur lagringen, alltså ett återbesök (K-16).
   *
   * Falskt för en plan som just skapats: då ska vyn börja högst upp.
   */
  isReturningVisit: boolean;
}

export default function PlanView({
  input,
  plans,
  warnings,
  advice,
  today,
  onChangeAnswers,
  onStartOver,
  isReturningVisit,
}: Props) {
  const aktuell = currentWeekIndex(plans, today);
  const [öppen, setÖppen] = useState<number | null>(aktuell);
  const aktuellRef = useRef<HTMLLIElement | null>(null);
  const rullaFram = shouldScrollToCurrentWeek(plans, today, isReturningVisit);

  useEffect(() => {
    // K-16: vid återbesöket ska veckan man är i synas utan att man letar.
    if (rullaFram) {
      // `start`, inte `center`: veckan man är i är utfälld och därmed hög, och
      // att centrera den lade rubriken med "Nu" 75 px ovanför skärmkanten.
      aktuellRef.current?.scrollIntoView({ block: 'start' });
      return;
    }

    // Annars högst upp. Vyn byter inte sida, så webbläsaren behåller
    // formulärets rullning — och då öppnas programmet på mitten.
    window.scrollTo({ top: 0 });
  }, [rullaFram]);

  const grupper = groupByPhase(plans);

  // Samma skala som årsremsan, så att stapeln på raden och stapeln i remsan
  // betyder exakt samma sak. Ett tal, ett ställe.
  const belastning = new Map(
    ribbonBars(plans).map((stapel) => [stapel.index, stapel.heightPercent]),
  );

  const loppnamn = plans.flatMap((plan) => plan.week.raceIds.map((id) => raceById(id).name));

  return (
    <div className="mx-auto max-w-2xl px-5 pt-8 pb-10">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">{PLAN.heading}</h1>
          <p className="mt-3 max-w-prose text-ink-2">
            {PLAN.summary(plans.length, totalHours(plans), input.hoursPerWeek)}
          </p>
        </header>

        {/*
          Svaret först. Frågan på en tisdagsmorgon är "vad ska jag göra i dag?",
          och den låg 726 ord och tre skärmar ner i sidan, bakom förklaring,
          säkerhetstexter och varningar. Allt det står kvar — men efter svaret.
        */}
        <Veckokort plans={plans} today={today} onOpen={setÖppen} />

        {/*
          Säkerhetstexterna först, och med den kraftigaste markeringen på sidan.
          Förut stod de i en grå ruta under varningarnas gula, vilket läste som
          mindre viktigt än ett volymriktmärke — fast det är det allvarligaste
          som står här. Vänsterkant i stället för fylld ruta, eftersom tonen
          inte ska skärpas: appen säger ifrån, den skäller inte.
        */}
        <section
          className="mt-8 border-l-2 border-critical bg-sunk px-4 py-3.5"
          aria-labelledby="sakerhet"
        >
          <h2 id="sakerhet" className="text-sm font-semibold text-ink">
            {PLAN.safetyHeading}
          </h2>
          <p className="mt-2 text-sm text-ink-2">{FIXED.redFlags}</p>
          <p className="mt-2 text-sm text-ink-2">{FIXED.painRule}</p>
          <p className="mt-2 text-sm text-ink-2">{FIXED.illness}</p>
        </section>

        {/* K-09: varningarna står överst, och planen visas ändå. */}
        {warnings.length > 0 && (
          <section className="mt-4" aria-labelledby="varningar">
            <h2 id="varningar" className="text-sm font-semibold text-ink">
              {PLAN.warningsHeading}
            </h2>
            <ul className="mt-2 space-y-2">
              {warnings.map((varning) => (
                <li
                  key={varning}
                  className="border-l-2 border-caution bg-sunk px-4 py-3 text-sm text-ink-2"
                >
                  {varning}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          Kursråden, skilda från varningarna sedan 2026-11-17. De säger inte
          "det här når inte ditt mål" utan "så här blir du bättre", och ska
          därför inte bära varningens markering.
        */}
        {advice.length > 0 && (
          <section className="mt-6" aria-labelledby="rad">
            <h2 id="rad" className="text-sm font-semibold text-ink">
              {PLAN.adviceHeading}
            </h2>
            <ul className="mt-2 space-y-2">
              {advice.map((råd) => (
                <li
                  key={råd}
                  className="rounded-card bg-sunk px-4 py-3 text-sm text-ink-2"
                >
                  {råd}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* A-04: sammanfattningen, skriven i förväg och granskad. */}
        <section className="mt-8">
          <p className="max-w-prose text-ink-2">{explanations.summary}</p>
          <p className="mt-2 text-sm text-ink-3">{FIXED.aiMarking}</p>
        </section>

        <YearRibbon plans={plans} raceNames={loppnamn} />

        <section className="mt-10" aria-labelledby="oversikt">
          <h2 id="oversikt" className="text-xl font-semibold tracking-tight">
            {PLAN.overviewHeading}
          </h2>

          {grupper.map((grupp) => (
            <section key={grupp.phaseId} className="mt-8">
              {/*
                Fasrubriken fäster överst medan fasens veckor rullar förbi, så
                att man alltid ser vilken fas man är i. Rent CSS och med flit:
                första försöket var en rad som räknade ut fasen ur sektionernas
                lägen under rullning, och den låg ett steg efter hela vägen ner.
                Webbläsaren kan det här bättre än vi kan räkna det.
              */}
              <h3 className="sticky top-0 z-10 -mx-5 bg-ground/95 px-5 py-2 text-sm font-semibold tracking-wide text-ink uppercase backdrop-blur">
                {grupp.title}
              </h3>
              <p className="mt-1 text-sm text-ink-3">{PLAN.phaseWeeks(grupp.weeks.length)}</p>

              {/* K-08: varför fasen finns. En text per fas (A-02). */}
              <p className="mt-2 max-w-prose text-sm text-ink-2">
                {explanations.phases[grupp.phase]}
              </p>

              {/*
                Fasens rygg: en tunn linje i marginalen som löper genom fasens
                veckor, så att indelningen syns medan man rullar i stället för
                att bara stå som en rubrik man passerat.
              */}
              <ul className="mt-4 border-l border-rule">
                {grupp.weeks.map((plan) => (
                  <Vecka
                    key={plan.week.index}
                    plan={plan}
                    öppen={öppen === plan.week.index}
                    aktuell={aktuell === plan.week.index}
                    belastning={belastning.get(plan.week.index) ?? 0}
                    ref={aktuell === plan.week.index ? aktuellRef : undefined}
                    onToggle={() => setÖppen(öppen === plan.week.index ? null : plan.week.index)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onChangeAnswers}
            className="rounded-field border border-rule-strong px-5 py-3 font-medium hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {PLAN.changeAnswers}
          </button>

          {/* K-10: det ska gå att börja om, men inte av misstag. */}
          <StartOver onStartOver={onStartOver} />
        </div>

        <footer className="mt-12 space-y-3 border-t border-rule pt-6 text-sm text-ink-3">
          <p className="max-w-prose">{FIXED.disclaimer}</p>
          <p className="max-w-prose">{FIXED.independence}</p>
        </footer>
    </div>
  );
}

/**
 * Veckan man är i, överst i planen (designöversynen 2026-11-17).
 *
 * Kortet upprepar inte veckovyn — det ger dagarna och passens namn, inte
 * instruktionerna. Frågan det svarar på är "vad gör jag den här veckan?", och
 * den som vill veta *hur* ett pass görs öppnar veckan längre ner, dit knappen
 * leder.
 *
 * Visas inte när planen är slut: då finns ingen vecka att vara i.
 */
function Veckokort({
  plans,
  today,
  onOpen,
}: {
  plans: WeekPlan[];
  today: IsoDate;
  onOpen: (index: number) => void;
}) {
  const vecka = currentWeek(plans, today);
  if (vecka === null) return null;

  const dagar = grupperaPerDag(vecka.sessions);
  const lopp = racesInWeek(vecka);
  const börjat = hasWeekStarted(vecka, today);

  return (
    <section
      className="mt-8 rounded-card border border-rule bg-surface p-4"
      aria-labelledby="veckokort"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="veckokort" className="font-semibold">
          {börjat ? PLAN.thisWeekHeading : PLAN.firstWeekHeading}
          <span className="ml-2 font-normal text-ink-3">
            {formatWeekRange(vecka.week.startDate)}
          </span>
        </h2>
        <p className="text-sm text-ink-2">{formatMinutes(vecka.totalMinutes)}</p>
      </div>

      <p className="mt-0.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">
        {weekFocus(vecka)}
        {lopp.length > 0 && ` · ${PLAN.raceWeek(lopp)}`}
      </p>

      <ul className="mt-3 divide-y divide-rule border-t border-rule">
        {dagar.map(({ date, sessions }) => (
          <li key={date} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3 py-1.5">
            <span className="text-sm text-ink-3">{formatDay(date, weekdayOf(date))}</span>

            <span className="min-w-0 text-sm">
              {sessions.map((session) => (
                <span key={session.id} className="flex items-center gap-1.5">
                  {session.sport !== null && (
                    <span
                      aria-hidden="true"
                      className={`inline-block size-2 shrink-0 rounded-full ${SPORT_COLORS[session.sport].dot}`}
                    />
                  )}
                  <span className="truncate">
                    {session.type === 'rest' ? PLAN.restShort : session.title}
                  </span>
                </span>
              ))}
            </span>

            <span className="text-right text-sm text-ink-3">
              {sessions
                .filter((session) => session.type !== 'rest')
                .map((session) => formatMinutes(session.minutes))
                .join(', ')}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => {
          onOpen(vecka.week.index);
          document.getElementById(`vecka-${vecka.week.index}`)?.scrollIntoView({ block: 'start' });
        }}
        className="mt-3 rounded-field text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {PLAN.openWeek}
      </button>
    </section>
  );
}

interface VeckaProps {
  plan: WeekPlan;
  öppen: boolean;
  aktuell: boolean;
  /** Veckans tid i procent av planens tyngsta vecka, till stapeln. */
  belastning: number;
  ref?: React.Ref<HTMLLIElement> | undefined;
  onToggle: () => void;
}

/** En vecka i översikten, som går att öppna till en veckovy (K-06, K-07). */
function Vecka({ plan, öppen, aktuell, belastning, ref, onToggle }: VeckaProps) {
  const lopp = racesInWeek(plan);

  // Vänsterkanten bär veckans läge: accent för den man är i, gult för en
  // loppvecka, inget för en vanlig. Den ersätter ramen som varje vecka hade
  // förut — fler ramar gjorde ingen vecka viktigare, bara listan rörigare.
  const kant = aktuell
    ? 'border-l-accent bg-accent-soft'
    : lopp.length > 0
      ? 'border-l-caution'
      : 'border-l-transparent';

  return (
    <li id={`vecka-${plan.week.index}`} ref={ref} className="scroll-mt-14 border-b border-rule">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={öppen}
        className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-l-2 py-2.5 pr-3 text-left hover:bg-sunk focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${kant}`}
      >
        <span className="pl-2.5 text-xs text-ink-3">{plan.week.index}</span>

        <span className="min-w-0">
          {/*
            Radbryt i stället för att kapa. En kapad rad hade tagit bort
            loppets namn först, och det är det viktigaste som står där — på en
            telefon lägger sig chipet på egen rad i stället.
          */}
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium">{formatWeekRange(plan.week.startDate)}</span>

            {aktuell && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">
                {PLAN.currentWeek}
              </span>
            )}

            {lopp.length > 0 && (
              <span className="rounded-full border border-caution bg-caution-soft px-2 py-0.5 text-[10px] font-semibold tracking-wider text-caution uppercase">
                {PLAN.raceWeek(lopp)}
              </span>
            )}

            {plan.week.isDeload && (
              <span className="rounded-full bg-sunk px-2 py-0.5 text-[10px] font-semibold tracking-wider text-ink-3 uppercase">
                {PLAN.deloadShort}
              </span>
            )}
          </span>

          {/*
            Veckans belastning som en stapel. Samma tal som står till höger,
            men läsbart utan att läsas: formen på fyra veckor syns direkt.
          */}
          <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-sunk">
            <span
              style={{ width: `${belastning}%` }}
              className={`block h-full rounded-full ${
                aktuell ? 'bg-accent' : lopp.length > 0 ? 'bg-caution' : 'bg-rule-strong'
              }`}
            />
          </span>
        </span>

        <span className="text-right text-sm text-ink-2">{formatMinutes(plan.totalMinutes)}</span>
      </button>

      {öppen && <Veckovy plan={plan} />}
    </li>
  );
}

/** Veckans sju dagar (K-07). */
function Veckovy({ plan }: { plan: WeekPlan }) {
  const dagar = grupperaPerDag(plan.sessions);

  return (
    <div className="border-t border-rule bg-ground px-4 py-4">
      <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{weekFocus(plan)}</p>

      <ul className="mt-3 space-y-3">
        {dagar.map(({ date, sessions }) => (
          <li key={date}>
            <p className="text-sm font-medium text-ink-3">{formatDay(date, weekdayOf(date))}</p>

            <ul className="mt-1 space-y-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className={`rounded-r-card border-l-2 bg-surface p-3 ${
                    session.sport === null
                      ? 'border-l-rule-strong'
                      : SPORT_COLORS[session.sport].edge
                  }`}
                >
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
  const zon = formatZone(session.zone, session.sport);

  if (session.type === 'rest') {
    return <p className="text-sm text-ink-3">{PLAN.rest}</p>;
  }

  return (
    <div>
      <p className="font-medium">
        {session.title}
        {gren !== null && session.sport !== null && (
          <span className="font-normal text-ink-3">
            {' — '}
            <span
              aria-hidden="true"
              className={`mr-1 inline-block size-2 rounded-full align-middle ${SPORT_COLORS[session.sport].dot}`}
            />
            {gren}
          </span>
        )}
        <span className="ml-2 text-sm font-normal text-ink-3">
          {formatMinutes(session.minutes)}
        </span>
      </p>

      {zon !== null && <p className="mt-1 text-sm text-ink-3">{zon}</p>}
      <p className="mt-1 text-sm text-ink-2">{session.instruction}</p>

      {session.alternatives.length > 0 && (
        <p className="mt-2 text-sm text-ink-3">
          {PLAN.alternatives(
            session.alternatives.map((alternativ) => {
              // R-37: en utrustningsvariant bär redskapets namn, inte grenens.
              const namn =
                alternativ.substitutedAs === undefined
                  ? (sessionSport({ ...session, sport: alternativ.sport }) as string)
                  : alternativ.title;
              return alternativ.note === '' ? namn : `${namn} (${alternativ.note})`;
            }),
          )}
        </p>
      )}

      {session.safetyNote !== undefined && (
        <p className="mt-2 border-l-2 border-caution bg-sunk px-2.5 py-1.5 text-sm text-ink-2">
          {session.safetyNote}
        </p>
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

/**
 * Knappen som kastar planen och börjar om (K-10).
 *
 * Den frågar först. Ett program på fyrtiosju veckor ska inte gå att radera
 * med ett felklick, och det är hela skälet till att K-13 höjdes till Måste.
 */
function StartOver({ onStartOver }: { onStartOver: () => void }) {
  const [frågar, setFrågar] = useState(false);

  if (!frågar) {
    return (
      <button
        type="button"
        onClick={() => setFrågar(true)}
        className="rounded-field px-5 py-3 font-medium text-ink-3 hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {STORAGE.startOver}
      </button>
    );
  }

  return (
    <div className="rounded-card border border-rule-strong bg-surface p-4">
      <p className="text-sm text-ink-2">{STORAGE.startOverConfirm}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onStartOver}
          className="rounded-field bg-critical px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-critical"
        >
          {STORAGE.startOver}
        </button>
        <button
          type="button"
          onClick={() => setFrågar(false)}
          className="rounded-field border border-rule-strong px-4 py-2 text-sm font-medium hover:bg-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {PLAN.cancel}
        </button>
      </div>
    </div>
  );
}
