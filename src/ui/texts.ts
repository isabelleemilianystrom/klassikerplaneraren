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

export const PAST_DATE_HELP = 'Loppet måste ligga framåt i tiden — kontrollera årtalet.';

export const CLASSIC_WINDOW_HELP =
  'Alla fyra loppen ska ligga inom tolv månader för att räknas som en klassiker. ' +
  'Du får börja med vilken gren du vill.';

export const DISCLAIMER =
  'Programmet är ett automatiskt förslag och ersätter inte medicinsk rådgivning. ' +
  'Rådgör med läkare innan du börjar träna hårt, särskilt vid sjukdom, skada eller graviditet.';
