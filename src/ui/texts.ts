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
    'Med dina timmar hinner l00e5ngpassen aldrig bli s00e5 l00e5nga som loppen kr00e4ver. Det 00e4r framf00f6r allt ' +
    'de riktigt l00e5nga passen som f00f6rbereder kroppen p00e5 ett l00e5ngt lopp 2014 avs00e4tt g00e4rna en l00e5ng dag i ' +
    'veckan n00e4rmare loppen, 00e4ven om veckan i 00f6vrigt 00e4r sig lik.',
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
