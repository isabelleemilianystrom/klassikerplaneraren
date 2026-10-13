/**
 * Delade typer. Programobjektet är rent JSON-vänligt: inga Date-instanser,
 * inga Map/Set, inga klasser. Datum är ISO-strängar.
 *
 * Inga användartexter här — svenska strängar bor i src/ui/texts.ts, så att
 * programobjektet är språkneutralt och kan serialiseras oförändrat.
 */

/** ISO-datum, YYYY-MM-DD. */
export type IsoDate = string;

/** De fyra grenarna i En svensk klassiker. */
export type Discipline = 'skiing' | 'cycling' | 'swimming' | 'running';

export const DISCIPLINES: readonly Discipline[] = ['skiing', 'cycling', 'swimming', 'running'];

/** Användarens nuvarande nivå i en gren. */
export type Level = 'beginner' | 'intermediate' | 'advanced';

/** Fas i periodiseringen mot ett lopp. */
export type Phase = 'base' | 'build' | 'peak' | 'taper' | 'recovery';

/** Syftet med ett pass. UI översätter till svensk text. */
export type SessionPurpose =
  | 'easy'
  | 'endurance'
  | 'longSession'
  | 'intervals'
  | 'technique'
  | 'strength'
  | 'rest';

/** Ersättningsform när grenen inte går att utöva i säsong. */
export type Substitute = 'skiErgometer' | 'rollerSkis';

/** Ett loppdatum per gren. */
export type RaceDates = Record<Discipline, IsoDate>;

/** Allt användaren matar in. */
export interface PlanInput {
  races: RaceDates;
  levels: Record<Discipline, Level>;
  hoursPerWeek: number;
}

export interface Session {
  discipline: Discipline;
  /** Satt när passet ersätter grenen utanför dess säsong. */
  substitute?: Substitute;
  hours: number;
  purpose: SessionPurpose;
}

export interface Week {
  /** Måndagen i veckan. */
  startDate: IsoDate;
  phase: Phase;
  /** Loppet veckan är periodiserad mot. */
  targetRace: Discipline;
  totalHours: number;
  sessions: Session[];
}

export interface Program {
  /** Höjs när formatet ändras, så sparade program kan migreras. */
  version: 1;
  createdAt: IsoDate;
  input: PlanInput;
  weeks: Week[];
}
