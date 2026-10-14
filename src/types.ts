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

/**
 * De fyra officiella varianterna av En Svensk Klassiker.
 * 'women' = En Svensk Klassiker – Tjej. Distanserna bor i src/variants.ts.
 */
export type ClassicVariant = 'full' | 'half' | 'short' | 'women';

/** Veckodag enligt ISO: 1 = måndag, 7 = söndag. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Vad användaren vill med ett lopp. Styr hur stor del av träningen som är hård.
 * Den som vill ta sig runt behöver volym och vana; den som har ett tidsmål
 * behöver mer kvalitet.
 */
export type Goal = 'finish' | 'improve' | 'time';

/**
 * Hur hårt passet ska köras.
 *
 * Utan detta blir den polariserade fördelningen en siffra i dokumentationen i
 * stället för något användaren utför. De flesta motionärer kör sina lugna pass
 * för hårt och sina hårda för löst.
 */
export type Intensity = 'easy' | 'moderate' | 'threshold' | 'interval';

/**
 * Passets upplägg. Nycklar, inte text — UI översätter till svenska.
 *
 * "Intervaller 0,5 h" säger ingenting till den som inte redan vet vad hon ska
 * göra. Strukturen säger det.
 */
export type SessionStructure =
  | 'steady'
  | 'longSteady'
  | 'thresholdBlocks'
  | 'shortIntervals'
  | 'hills'
  | 'techniqueDrills'
  | 'openWaterSkills'
  | 'strengthCircuit';

/** Pass delas i kondition och styrka — inte i vilket lopp de tränar mot. */
export type SessionKind = 'endurance' | 'strength';

/**
 * Hur viktigt passet är den vecka det ligger.
 *
 * `key` är veckans bärande pass: långpasset och kvalitetspasset. `supporting`
 * är de som får stryka på foten när livet kommer emellan. Att skriva ut det
 * gör det lättare att missa ett pass utan dåligt samvete.
 */
export type SessionPriority = 'key' | 'supporting';

/** När och hur ofta användaren kan träna. */
export interface TrainingDays {
  /** Antal dagar i veckan användaren kan träna. */
  daysPerWeek: number;
  /** Dagen användaren helst lägger långpasset på. */
  longSessionDay: Weekday;
  /** Dagar som aldrig får användas. */
  unavailableDays: Weekday[];
}

/** Månad 1–12. Snöperioden återkommer varje år och hör inte till ett årtal. */
export type Month = number;

/**
 * Månaderna då användaren har tillgång till snö, båda inklusive.
 * Perioden får gå över nyår, alltså `startMonth` senare i året än `endMonth`
 * (december till mars är `{ startMonth: 12, endMonth: 3 }`).
 */
export interface SnowSeason {
  startMonth: Month;
  endMonth: Month;
}

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

/**
 * Ersättningsform när grenen inte går att utöva i säsong.
 * `polesAndStrength` är fallbacken för den som varken har stakmaskin eller
 * rullskidor: stavgång i backe plus överkroppsstyrka.
 */
export type Substitute = 'skiErgometer' | 'rollerSkis' | 'polesAndStrength' | 'indoorTrainer';

/**
 * Utrustning användaren kommer åt. Styr vilken form skidträningen tar utanför
 * snöperioden, och om cykelträning kan ske inomhus på vintern.
 */
export interface Equipment {
  skiErgometer: boolean;
  rollerSkis: boolean;
  indoorTrainer: boolean;
}

/** Sådant programmet vill varna för, som UI översätter till svensk text. */
export type ProgramWarning =
  | 'tightBudget'
  | 'noSkiSubstitute'
  | 'longSessionTooShort'
  | 'noOpenWaterBeforeSwim';

/** Ett loppdatum per gren. */
export type RaceDates = Record<Discipline, IsoDate>;

/** Allt användaren matar in. */
export interface PlanInput {
  /** Vilken klassiker som ska genomföras. Avgör distanserna att träna mot. */
  variant: ClassicVariant;
  /**
   * Användaren åker Engelbrektsloppet som sitt skidlopp. Spelar bara roll i den
   * hela klassikern, där det är 60 km istället för Vasaloppets 90 km.
   */
  engelbrektsloppet: boolean;
  races: RaceDates;
  levels: Record<Discipline, Level>;
  hoursPerWeek: number;
  /** När skidträning kan ske på snö. Utanför perioden ersätts skidpassen. */
  snowSeason: SnowSeason;
  /**
   * När användaren kommer åt öppet vatten.
   *
   * Vansbrosimningen simmas i våtdräkt, medströms, utan linjer att följa. Den
   * som bara simmat i bassäng möter kallt vatten, en dräkt som trycker över
   * bröstet och ingen möjlighet att sikta — allt samtidigt, på loppdagen.
   */
  openWaterSeason: SnowSeason;
  /** Vad användaren kommer åt. Styr vilken form ersättningspassen tar. */
  equipment: Equipment;
  /** Vad användaren vill med varje lopp. */
  goals: Record<Discipline, Goal>;
  /** När användaren kan träna. */
  trainingDays: TrainingDays;
}

export interface Session {
  discipline: Discipline;
  /** Satt när passet ersätter grenen utanför dess säsong. */
  substitute?: Substitute;
  kind: SessionKind;
  priority: SessionPriority;
  intensity: Intensity;
  structure: SessionStructure;
  /** Passet sker i öppet vatten med våtdräkt, inte i bassäng. */
  openWater?: true;
  /** Veckodagen passet ligger på. */
  day: Weekday;
  hours: number;
  purpose: SessionPurpose;
}

/**
 * Ett block är den sammanhängande perioden fram till ett eller två lopp.
 *
 * Blocket bär fokuset, inte det enskilda passet. Ligger två lopp nära varandra
 * — som Vätternrundan och Vansbrosimningen — delar de block.
 */
export interface Block {
  /** Loppen blocket siktar mot, i datumordning. */
  focus: Discipline[];
  /** Måndagen i blockets första vecka. */
  startDate: IsoDate;
  /** Måndagen i blockets sista vecka. */
  endDate: IsoDate;
}

export interface Week {
  /** Måndagen i veckan. */
  startDate: IsoDate;
  phase: Phase;
  /** Loppet veckan är periodiserad mot. */
  targetRace: Discipline;
  /** Veckan ligger direkt efter ett lopp och ska vara lättare än fasen kräver. */
  followsRace: boolean;
  /** Index i programmets blocklista. */
  block: number;
  /** Satt när ett lopp går den här veckan. Loppet är veckans huvudhändelse. */
  raceDate?: IsoDate;
  totalHours: number;
  sessions: Session[];
}

export interface Program {
  /** Höjs när formatet ändras, så sparade program kan migreras. */
  version: 1;
  createdAt: IsoDate;
  input: PlanInput;
  blocks: Block[];
  weeks: Week[];
  /** Sådant användaren bör känna till om sitt program. Nycklar, inte text. */
  warnings: ProgramWarning[];
}
