/**
 * All svensk text som visas för användaren, samlad på ett ställe.
 * Logiken i src/generator/ hanterar nycklar, aldrig färdiga strängar.
 */
import type { ClassicVariant, Discipline, Phase, SessionPurpose, Substitute } from '../types';

export const APP_NAME = 'Klassikerplaneraren';

/** Officiella namn på varianterna, som de står hos arrangören. */
export const VARIANT_LABEL: Record<ClassicVariant, string> = {
  full: 'En Svensk Klassiker',
  half: 'En Svensk Klassiker – Halva',
  short: 'En Svensk Klassiker – Korta',
  women: 'En Svensk Klassiker – Tjej',
};

/** Distanserna i varje variant, för att hjälpa användaren att välja rätt. */
export const VARIANT_SUMMARY: Record<ClassicVariant, string> = {
  full: '90 km skidor · 315 km cykel · 3 km simning · 30 km löpning',
  half: '45 km skidor · 150 km cykel · 1,5 km simning · 15 km löpning',
  short: '30 km skidor · 100 km cykel · 1 km simning · 10 km löpning',
  women: '30 km skidor · 100 km cykel · 1 km simning · 10 km löpning',
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  skiing: 'Längdskidor',
  cycling: 'Cykel',
  swimming: 'Simning',
  running: 'Löpning',
};

/**
 * Loppet i en gren, utan namn. Vilket lopp det faktiskt är beror på varianten
 * — skidloppet kan vara Vasaloppet, Halvvasan eller Tjejvasan — så vi skriver
 * aldrig ut ett loppnamn som bara stämmer för en variant.
 */
export const RACE_LABEL: Record<Discipline, string> = {
  skiing: 'skidloppet',
  cycling: 'cykelloppet',
  swimming: 'simloppet',
  running: 'löparloppet',
};

export const PHASE_LABEL: Record<Phase, string> = {
  base: 'Uppbyggnad',
  build: 'Uppbyggnad',
  peak: 'Toppning',
  taper: 'Nedtrappning',
  recovery: 'Återhämtning',
};

export const PURPOSE_LABEL: Record<SessionPurpose, string> = {
  easy: 'Lugnt distanspass',
  endurance: 'Uthållighet',
  longSession: 'Långpass',
  intervals: 'Intervaller',
  technique: 'Teknik',
  strength: 'Styrka',
  rest: 'Vila',
};

export const SUBSTITUTE_LABEL: Record<Substitute, string> = {
  skiErgometer: 'stakmaskin',
  rollerSkis: 'rullskidor',
  polesAndStrength: 'stavgång och styrka',
  indoorTrainer: 'trainer inomhus',
};

export const LEVEL_LABEL = {
  beginner: 'Nybörjare',
  intermediate: 'Vana',
  advanced: 'Rutinerad',
} as const;

/** Index 0 = januari. */
export const MONTH_LABEL: readonly string[] = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
];

export const ENGELBREKTSLOPPET_LABEL = 'Jag åker Engelbrektsloppet (60 km)';

export const ENGELBREKTSLOPPET_HELP =
  'Engelbrektsloppet godkänns istället för Vasaloppet i den hela klassikern, men är 60 km ' +
  'i stället för 90. Kryssa i rutan så tränar programmet mot rätt distans.';

export const SNOW_SEASON_HELP =
  'När har du tillgång till snö? Utanför perioden byts skidpassen mot stakmaskin eller ' +
  'rullskidor — de försvinner aldrig ur programmet.';

export const SUGGEST_DATES_LABEL = 'Fyll i kommande loppdatum';

/** Datumen ligger i koden och kan ha hunnit ändras hos arrangören. */
export function suggestionNote(checked: string): string {
  return `Förslagen är hämtade från arrangörernas sidor ${checked} och fylls i åt dig. Stäm alltid av mot arrangören innan du anmäler dig.`;
}

export function suggestionResult(filled: number, missing: number): string {
  const base = filled === 1 ? 'Ett datum ifyllt.' : `${filled} datum ifyllda.`;
  if (missing === 0) return `${base} Kontrollera dem mot arrangörens sida.`;
  const rest =
    missing === 1
      ? 'Ett lopp saknar belagt datum — fyll i det själv.'
      : `${missing} lopp saknar belagda datum — fyll i dem själv.`;
  return `${base} ${rest}`;
}

export const SUGGEST_DATES_NONE =
  'Förslagen i appen har passerat och behöver uppdateras. Fyll i datumen själv så länge.';

export const PAST_DATE_HELP = 'Loppet måste ligga framåt i tiden — kontrollera årtalet.';

export const CLASSIC_WINDOW_HELP =
  'Alla fyra loppen ska ligga inom tolv månader för att räknas som en klassiker. ' +
  'Du får börja med vilken gren du vill.';

export const DISCLAIMER =
  'Programmet är ett automatiskt förslag och ersätter inte medicinsk rådgivning. ' +
  'Rådgör med läkare innan du börjar träna hårt, särskilt vid sjukdom, skada eller graviditet.';

/** Utrustning vi frågar om, i den ordning den visas. */
export const EQUIPMENT_LABEL = {
  skiErgometer: 'Stakmaskin (SkiErg)',
  rollerSkis: 'Rullskidor',
  indoorTrainer: 'Trainer eller inomhuscykel',
} as const;

export const EQUIPMENT_HELP =
  'Styr vad skidpassen blir när det inte finns snö. Har du varken stakmaskin eller rullskidor ' +
  'blir de stavgång och överkroppsstyrka — det fungerar, men ger mindre skidspecifik träning.';

/** Varningar om programmet. Nycklarna kommer från generatorn. */
export const WARNING_TEXT = {
  tightBudget:
    'Med så få timmar i veckan blir programmet tunt för en hel klassiker. Du får ett program ' +
    'ändå — det prioriterar nästa lopp och de grenar du är nybörjare i — men räkna med att ' +
    'behöva mer tid närmare loppen.',
  longSessionTooShort:
    'Med dina timmar hinner långpassen aldrig bli så långa som loppen kräver. Det är framför allt ' +
    'de riktigt långa passen som förbereder kroppen på ett långt lopp — avsätt gärna en lång dag i ' +
    'veckan närmare loppen, även om veckan i övrigt är sig lik.',
  noOpenWaterBeforeSwim:
    'Programmet hinner inte lägga några simpass i öppet vatten före simloppet. Att första gången i ' +
    'våtdräkt och kallt vatten blir på tävlingsdagen är den vanligaste orsaken till att folk bryter. ' +
    'Försök få in minst två simpass utomhus innan loppet.',
  noSkiSubstitute:
    'Du har varken stakmaskin eller rullskidor, så skidpassen utanför snöperioden blir stavgång ' +
    'och överkroppsstyrka. Får du tillgång till något av dem blir skidträningen klart bättre.',
} as const;

export const GOAL_LABEL = {
  finish: 'Ta mig runt',
  improve: 'Klara det med god marginal',
  time: 'Jag har ett tidsmål',
} as const;

export const GOAL_HELP =
  'Målet styr hur hård träningen blir. Vill du ta dig runt bygger programmet mest volym och ' +
  'vana. Har du ett tidsmål läggs mer tid på fartträning.';

export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'måndag',
  2: 'tisdag',
  3: 'onsdag',
  4: 'torsdag',
  5: 'fredag',
  6: 'lördag',
  7: 'söndag',
};

export const TRAINING_DAYS_LEGEND = 'Din träningsvecka';

export const TRAINING_DAYS_HELP =
  'Programmet lägger passen på de dagar du faktiskt kan träna. Långpasset hamnar på din ' +
  'önskade dag, och det hårda passet så långt från det som veckan tillåter.';

export const DAYS_PER_WEEK_LABEL = 'Dagar i veckan du kan träna';
export const LONG_DAY_LABEL = 'Dag för långpass';
export const UNAVAILABLE_DAYS_LABEL = 'Dagar du inte kan träna';

export const SESSION_KIND_LABEL = {
  endurance: 'Kondition',
  strength: 'Styrka',
} as const;

export const PRIORITY_LABEL = {
  key: 'Nyckelpass',
  supporting: 'Stödpass',
} as const;

/** Står en gång per vecka, så att det går att missa ett pass utan ångest. */
export const PRIORITY_HELP =
  'Räcker inte veckan till: behåll nyckelpassen och stryk stödpassen. En vilodag är bättre än ' +
  'ett illa genomfört pass — bli du sjuk eller trött, hoppa över och fortsätt nästa vecka.';

export function blockHeading(index: number, focus: string[]): string {
  return `Block ${index + 1} — fokus ${focus.join(' och ')}`;
}

/** Hur hårt passet ska köras, med zon och upplevd ansträngning. */
export const INTENSITY_LABEL = {
  easy: 'Lugnt · zon 1–2 · du kan prata obehindrat',
  moderate: 'Medel · zon 3 · ansträngande men kontrollerat',
  threshold: 'Tröskel · zon 4 · du kan säga korta meningar',
  interval: 'Hårt · zon 4–5 · bara enstaka ord',
} as const;

/** Kort version till passraden. */
export const INTENSITY_SHORT = {
  easy: 'zon 1–2',
  moderate: 'zon 3',
  threshold: 'zon 4',
  interval: 'zon 4–5',
} as const;

/** Vad passet går ut på rent praktiskt. */
export const STRUCTURE_LABEL = {
  steady: 'Jämnt tempo hela passet.',
  longSteady: 'Långt och jämnt. Ta med dryck och energi — öva på det du tänkt äta i loppet.',
  thresholdBlocks: '4 × 8 min i tröskeltempo, 3 min lugnt emellan. 10 min uppvärmning och nedvarvning.',
  shortIntervals: '2 × 10 × 30 sek hårt / 30 sek vila, 3 min mellan serierna.',
  hills: '6–8 backintervaller på 1–2 min, lugn jogg ner. Bygger den styrka terrängen kräver.',
  techniqueDrills: 'Teknikpass: korta repetitioner med fokus på rörelsen, inte på farten.',
  openWaterSkills:
    'Öppet vatten med våtdräkt. Öva att sikta mot ett fast märke var sjätte till tionde ' +
    'simtag, och att starta i ett sällskap.',
  strengthCircuit: 'Helkroppsstyrka: knäböj, marklyft, rodd, press och bål. 3–4 set per övning.',
} as const;

export const OPEN_WATER_TAG = 'öppet vatten';

export const OPEN_WATER_LEGEND = 'Öppet vatten';

export const OPEN_WATER_HELP =
  'När kan du simma utomhus? Vansbrosimningen simmas i våtdräkt, medströms och utan linjer att ' +
  'följa. Programmet lägger simpassen utomhus under den här perioden, med siktträning.';

export const OPEN_WATER_START_LABEL = 'Öppet vatten från och med';
export const OPEN_WATER_END_LABEL = 'Till och med';

export const EXPORT_LABEL = 'Ladda ner till kalendern (.ics)';

export const EXPORT_HELP =
  'Varje pass blir en heldagshändelse med upplägg och intensitet, och loppen läggs in som egna ' +
  'händelser. Filen skapas i din webbläsare och skickas inte någonstans.';

export const ICS_FILENAME = 'klassikerplaneraren.ics';
