/**
 * Datamodellen från kravspecens avsnitt 7.
 *
 * Ändras inte utan att fråga. Typerna är med flit snäva unionstyper i stället
 * för lösa strängar: en felstavad fas ska vara ett kompileringsfel, inte något
 * som upptäcks när en användare får fel plan.
 */

export type Sport = 'ski' | 'bike' | 'swim' | 'run' | 'strength';

export type RaceId = 'vasaloppet' | 'vatternrundan' | 'vansbrosimningen' | 'lidingoloppet';

/** Ny, Van, Erfaren — se nivåtabellen i avsnitt 5. */
export type Level = 'new' | 'experienced' | 'advanced';

export type Phase = 'base' | 'specific' | 'taper' | 'recovery';

export type SessionType =
  | 'easy'
  | 'long'
  | 'tempo'
  | 'intervals'
  | 'technique'
  | 'strength'
  | 'rest'
  | 'race';

/** Pulszon 1–4. Vila och styrka har ingen zon. */
export type Zone = 1 | 2 | 3 | 4;

/** Datum som `YYYY-MM-DD`, lokalt och utan klockslag. */
export type IsoDate = string;

/** Sporterna användaren kan ange nivå i. Styrka är inte en av dem. */
export type TrainedSport = Exclude<Sport, 'strength'>;

/**
 * Vad användaren vill med ett lopp (R-38).
 *
 * `finish` — ta sig i mål. `time` — sikta på en tid.
 *
 * Skillnaden är stor i träningsupplägg. Den som bara vill komma runt
 * Vansbrosimningen behöver vattenvana och teknik, inte simvolym. Den som vill
 * slå en tid behöver bådadera.
 */
export type RaceGoal = 'finish' | 'time';

/** Veckodag enligt ISO: 1 = måndag, 7 = söndag. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * De dagar användaren själv väljer.
 *
 * Appen är byggd för folk med jobb. Alla har inte helgen fri, och ett program
 * som lägger långpasset på en söndag man jobbar är ett program man inte kan
 * följa. De två dagarna måste vara olika — vilodagen ska vara helt fri.
 */
export interface PreferredDays {
  /** Dagen långpasset läggs på (R-13). */
  longSession: Weekday;
  /** Dagen som alltid är helt fri (R-11). */
  rest: Weekday;
}

export interface PlanInput {
  schemaVersion: 3;
  today: IsoDate;
  startDate: IsoDate;
  /** Varje lopp med sitt datum och vad användaren vill med det (R-38). */
  races: { id: RaceId; date: IsoDate; goal: RaceGoal }[];
  levels: Partial<Record<TrainedSport, Level>>;
  /** 3–15 timmar, heltal. */
  hoursPerWeek: number;
  preferredDays: PreferredDays;
  equipment: {
    snowOrRollerSkis: boolean;
    skiErg: boolean;
    pool: boolean;
    bike: boolean;
  };
}

/**
 * En gren passet också kan göras i (R-37).
 *
 * Passet är det primära — ett långpass är ett långpass. Grenen som står först
 * är den som passar nästa lopp bäst, men den som hellre vill, eller måste,
 * byta ska kunna göra det utan att tappa poängen med passet.
 */
export interface SessionAlternative {
  sport: TrainedSport;
  title: string;
  /** Kort skäl, t.ex. "om det finns snö". Tom när inget villkor gäller. */
  note: string;
}

export interface Session {
  /** Stabilt id, t.ex. `w05-d3-1`. */
  id: string;
  date: IsoDate;
  /** Grenen som passar nästa lopp bäst. null för vila. */
  sport: Sport | null;
  type: SessionType;
  minutes: number;
  zone: Zone | null;
  title: string;
  instruction: string;
  /**
   * Grenar passet också kan göras i (R-37). Tom lista när inget alternativ
   * finns: loppet, vilan, styrkan och teknikpassen har inga.
   */
  alternatives: SessionAlternative[];
  /**
   * Satt när användaren saknar utrustning för grenen och passet därför görs
   * på ett annat sätt (R-17, R-18, R-20). Titeln och instruktionen är redan
   * ersättningens — det här fältet säger *vilken* ersättning det är, så att
   * gränssnittet kan visa skälet.
   */
  substitutedAs?: string;
  safetyNote?: string;
  /**
   * Vilket lopp passet är, satt på pass av typen `race`.
   *
   * Veckan har `focusRaceId`, men bara ett. Går två lopp samma vecka (R-27)
   * är det andra ett pass här, och utan id:t skulle koden behöva leta efter
   * loppets namn i titeln.
   */
  raceId?: RaceId;
}

export interface Week {
  /** 1, 2, 3 … */
  index: number;
  /** Måndag. */
  startDate: IsoDate;
  phase: Phase;
  /** Samma för sammanhängande veckor i samma fas och mot samma lopp. */
  phaseId: string;
  focusRaceId: RaceId | null;
  isDeload: boolean;
  totalMinutes: number;
  sessions: Session[];
}

export interface Plan {
  schemaVersion: 3;
  rulesVersion: string;
  promptVersion: string | null;
  input: PlanInput;
  weeks: Week[];
  warnings: string[];
  explanations: {
    summary: string;
    phases: Record<string, string>;
    source: 'ai' | 'fallback';
  };
}
