/**
 * Scheman för filerna i `config/`, och den validerade konfigurationen.
 *
 * Konfigurationen valideras när modulen laddas, alltså när appen startar och i
 * testerna. En felskriven siffra ska stoppa bygget, inte dyka upp som en konstig
 * plan hos en användare.
 */
import { z } from 'zod';
import racesFile from '../../config/races.json' with { type: 'json' };
import rulesFile from '../../config/rules.json' with { type: 'json' };
import sessionsFile from '../../config/sessions.json' with { type: 'json' };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'datum ska vara YYYY-MM-DD');
const share = z.number().min(0).max(1);

const sport = z.enum(['ski', 'bike', 'swim', 'run', 'strength']);
const raceId = z.enum(['vasaloppet', 'vatternrundan', 'vansbrosimningen', 'lidingoloppet']);
const sessionType = z.enum([
  'easy',
  'long',
  'tempo',
  'intervals',
  'technique',
  'strength',
  'rest',
  'race',
]);

/** Ett pass som text: titel och instruktion. Båda krävs enligt R-30. */
const textEntry = z.object({
  title: z.string().min(1),
  instruction: z.string().min(1),
});

export const racesSchema = z.object({
  schemaVersion: z.literal(1),
  source: z.string().min(1),
  checkedOn: isoDate,
  note: z.string(),
  races: z
    .array(
      z.object({
        id: raceId,
        name: z.string().min(1),
        sport: sport,
        distanceKm: z.number().positive(),
        estimatedHours: z.number().positive(),
        /**
         * Loppets kommande datum i kronologisk ordning.
         *
         * Flera, eftersom en klassiker kan börja när som helst på året: den som
         * startar på våren behöver nästa års datum för de lopp som redan gått.
         * Listan får vara kort — den innehåller bara det arrangörerna publicerat.
         */
        dates: z
          .array(isoDate)
          .nonempty()
          .refine(
            (dates) => dates.every((datum, i) => i === 0 || (dates[i - 1] as string) < datum),
            { message: "dates måste vara i kronologisk ordning och utan dubbletter" },
          ),
        /**
         * Kilometer man bör ha samlat i loppets gren före loppet, räknat över
         * alla pass tillsammans. Saknas talet ges ingen varning. Se R-34.
         */
        volumeMilestoneKm: z.number().positive().optional(),
        taperWeeks: z.number().int().positive(),
        recoveryWeeks: z.number().int().nonnegative(),
        specificWeeks: z.number().int().positive(),
      }),
    )
    .length(4),
});

export const rulesSchema = z.object({
  schemaVersion: z.literal(1),
  rulesVersion: z.string().min(1),
  note: z.string(),
  weekTime: z.object({
    _rule: z.string(),
    phaseShare: z.object({ base: share, specific: share, recovery: share }),
    taperShare: z.object({ firstWeek: share, secondWeek: share, singleWeek: share }),
    deload: z.object({ everyNthWeek: z.number().int().positive(), share }),
    firstWeeks: z.object({ count: z.number().int().positive(), maxShare: share }),
  }),
  raceLoad: z.object({ _rule: z.string(), subtractEstimatedRaceHours: z.boolean() }),
  leftoverMinutes: z.object({ _rule: z.string(), distributeIntoExistingSessions: z.boolean() }),
  sportSplit: z.object({
    _rule: z.string(),
    specific: z.object({
      raceSportShare: share,
      raceSportShareWhenTwoSports: share,
      raceSportShareWhenOneSport: share,
    }),
    base: z.object({ newLevelBonus: share, minShareOfEvenSplit: share }),
  }),
  strength: z.object({
    _rule: z.string(),
    minutesPerSession: z.number().int().positive(),
    sessionsByPhase: z.object({
      base: z.number().int().nonnegative(),
      specific: z.number().int().nonnegative(),
      taper: z.number().int().nonnegative(),
      recovery: z.number().int().nonnegative(),
    }),
  }),
  trainingDays: z.object({
    _rule: z.string(),
    byHoursPerWeek: z
      .array(
        z.object({
          upToHours: z.number().positive(),
          days: z.number().int().min(1).max(7),
        }),
      )
      .min(1),
    minRestDays: z.number().int().min(1),
    /** Vilodagen läggs här först. 1 = måndag, dagen efter helgens långpass. */
    preferredRestWeekday: z.number().int().min(1).max(7),
  }),
  session: z.object({
    _rule: z.string(),
    minMinutes: z.number().int().positive(),
    maxMinutes: z.number().int().positive(),
  }),
  longSession: z.object({
    _rule: z.string(),
    maxShareOfWeek: share,
    capMinutesBySport: z.object({
      ski: z.number().int().positive(),
      bike: z.number().int().positive(),
      run: z.number().int().positive(),
      swim: z.number().int().positive(),
    }),
    allowedWeekdays: z.array(z.number().int().min(1).max(7)).min(1),
    note: z.string(),
    /**
     * Långpassets kurva per fas: andel av grenens tak i fasens första och
     * sista vecka. Den specifika fasen tar vid där basen slutade. Se R-13.
     */
    growthByPhase: z.object({
      base: z.object({ startShareOfCap: share, endShareOfCap: share }),
      specific: z.object({ startShareOfCap: share, endShareOfCap: share }),
    }),
    /** Under det här är passet inget långpass, och planen får inget alls. */
    minMinutes: z.number().int().positive(),
    /**
     * Antal sista veckor i en specifik fas där långpasset får låna tid från de
     * andra grenarna, upp till `maxShareOfWeek`. Se R-13.
     */
    borrowInFinalWeeks: z.number().int().nonnegative(),
  }),
  seasonWeights: z
    .object({
      _rule: z.string(),
      note: z.string(),
      /**
       * Grenar vars vikt sänks för den som inte är nybörjare. Vansbrosimningen
       * är 5 procent av klassikerns lopptid; den som redan kan simma har tiden
       * bättre använd på skidor eller cykel. Se R-32.
       */
      experiencedWeightOverride: z.partialRecord(sport, share),
      seasons: z
        .array(
          z.object({
            name: z.string().min(1),
            months: z.array(z.number().int().min(1).max(12)).nonempty(),
            weights: z
              .object({ ski: share, bike: share, swim: share, run: share })
              .refine(
                (w) => Math.abs(w.ski + w.bike + w.swim + w.run - 1) < 1e-9,
                { message: "vikterna i en säsong måste summera till 1" },
              ),
          }),
        )
        .nonempty(),
    })
    // Varje månad måste höra till exakt en säsong. Annars finns det veckor
    // motorn inte vet hur den ska fördela, och det ska stoppa bygget.
    .refine(
      ({ seasons }) => {
        const alla = seasons.flatMap((säsong) => säsong.months);
        return alla.length === 12 && new Set(alla).size === 12;
      },
      { message: "säsongerna måste täcka alla tolv månader exakt en gång" },
    ),
  newLevelLimits: z.object({
    _rule: z.string(),
    note: z.string(),
    /** Per sport. Saknas sporten har den ingen gräns. Se R-31. */
    bySport: z.partialRecord(
      sport,
      z.object({
        maxMinutesPerWeek: z.number().int().positive(),
        maxSessionsPerWeek: z.number().int().positive(),
      }),
    ),
  }),
  runVolume: z.object({
    _rule: z.string(),
    maxWeeklyIncrease: share,
    noBackToBackForNewLevel: z.boolean(),
  }),
  intensity: z.object({
    _rule: z.string(),
    zoneText: z.object({
      '1': z.string().min(1),
      '2': z.string().min(1),
      '3': z.string().min(1),
      '4': z.string().min(1),
    }),
    byPhase: z.object({
      base: z.object({ hardSessionsPerWeek: z.number().int().nonnegative(), maxZone: z.number().int().min(1).max(4) }),
      specific: z.object({
        hardSessionsPerWeek: z.number().int().nonnegative(),
        maxZone: z.number().int().min(1).max(4),
        maxZoneForNewLevel: z.number().int().min(1).max(4),
      }),
      taper: z.object({
        hardSessionsPerWeek: z.number().int().nonnegative(),
        maxZone: z.number().int().min(1).max(4),
        /** R-15: "korta inslag i zon 3". Utan tak blir det ett helt pass. */
        maxHardMinutes: z.number().int().positive(),
      }),
      recovery: z.object({ hardSessionsPerWeek: z.number().int().nonnegative(), maxZone: z.number().int().min(1).max(4) }),
    }),
    noHardDaysBackToBack: z.boolean(),
  }),
  blocks: z.object({
    _rule: z.string(),
    sharedBlockMaxWeeks: z.number().int().positive(),
    taperWeeksWhenShared: z.number().int().positive(),
  }),
  raceDay: z.object({
    _rule: z.string(),
    openerMinutesDayBefore: z.number().int().nonnegative(),
    openerMaxZone: z.number().int().min(1).max(4),
  }),
  season: z.object({
    _rule: z.string(),
    openWaterMonths: z.array(z.number().int().min(1).max(12)).min(1),
    swimDrylandBeforeMonth: z.number().int().min(1).max(12),
  }),
  /** R-37: grenar ett pass också kan göras i. */
  sessionAlternatives: z.object({
    _rule: z.string(),
    note: z.string(),
    forTypes: z.array(sessionType).min(1),
    interchangeable: z.array(sport).min(1),
    /** Månader grenen går att utöva. Saknas grenen gäller den året om. */
    seasonalMonths: z.partialRecord(sport, z.array(z.number().int().min(1).max(12)).min(1)),
    /** Grenen kräver minst en av dessa utrustningsflaggor. */
    requiresAnyEquipment: z.partialRecord(sport, z.array(z.string().min(1)).min(1)),
    notes: z.partialRecord(sport, z.string()),
  }),
  /** R-36: vad som händer med en gren vars lopp är avklarat. */
  afterRace: z.object({
    _rule: z.string(),
    note: z.string(),
    keepShareInOwnSeason: share,
  }),
  /** R-33: grenar som behåller teknikpass under återhämtningen. */
  recovery: z.object({
    _rule: z.string(),
    note: z.string(),
    techniqueSports: z.array(sport).min(1),
  }),
  /** R-34: snittfart per gren, bara för att räkna om tid till kilometer. */
  trainingSpeedKmh: z
    .object({ _rule: z.string(), note: z.string() })
    .catchall(z.number().positive()),
  classicWindow: z.object({ _rule: z.string(), months: z.number().int().positive() }),
  warnings: z.object({
    _rule: z.string(),
    shortPreparation: z.object({ weeksThreshold: z.number().int().positive(), text: z.string().min(1) }),
    lowHours: z.object({
      hoursThresholdWithLongRace: z.number().positive(),
      hoursThresholdOtherwise: z.number().positive(),
      longRaceIds: z.array(raceId).min(1),
      text: z.string().min(1),
    }),
    skiTechnique: z.object({ text: z.string().min(1) }),
    outsideClassicWindow: z.object({ text: z.string().min(1) }),
    volumeMilestone: z.object({ _rule: z.string(), text: z.string().min(1) }),
    midProgramme: z.object({
      _rule: z.string(),
      weeksThreshold: z.number().int().positive(),
      note: z.string(),
      text: z.string().min(1),
      noBaseSuffix: z.string().min(1),
    }),
  }),
});

export const sessionsSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string(),
  // R-30: varje passtyp måste finnas. Saknas en är det ett fel, inte ett tomt fält.
  types: z.record(sessionType, textEntry),
  sportVariants: z.record(z.string(), textEntry),
  substitutes: z.record(z.string(), textEntry.extend({ _rule: z.string() })),
  /** R-10: styrkans text, viktad mot ett lopp där grenen kräver det. */
  strengthVariants: z.object({
    _rule: z.string(),
    note: z.string(),
    byRace: z.partialRecord(raceId, textEntry),
  }),
  strengthExercises: z.object({
    _rule: z.string(),
    exercises: z.array(z.object({ name: z.string().min(1), focus: z.string().min(1) })).min(1),
    /** Övningar viktade mot ett lopp. Saknas loppet används exercises. */
    byRace: z.partialRecord(raceId, z.array(z.object({ name: z.string().min(1), focus: z.string().min(1) })).min(1)),
  }),
  safetyNotes: z.object({
    openWater: z.object({ _rule: z.string(), text: z.string().min(1) }),
  }),
});

export type RacesConfig = z.infer<typeof racesSchema>;
export type RulesConfig = z.infer<typeof rulesSchema>;
export type SessionsConfig = z.infer<typeof sessionsSchema>;

/**
 * Den validerade konfigurationen.
 *
 * `parse` kastar vid fel, vilket är meningen: hellre ett tydligt fel vid start
 * än en plan byggd på en felskriven siffra.
 */
export const races: RacesConfig = racesSchema.parse(racesFile);
export const rules: RulesConfig = rulesSchema.parse(rulesFile);
export const sessions: SessionsConfig = sessionsSchema.parse(sessionsFile);

/** Loppet med ett visst id. Kastar om det inte finns. */
export function raceById(id: RacesConfig['races'][number]['id']): RacesConfig['races'][number] {
  const race = races.races.find((candidate) => candidate.id === id);
  if (race === undefined) throw new Error(`Loppet ${id} finns inte i config/races.json`);
  return race;
}

/**
 * Loppets första datum på eller efter `onOrAfter`, eller null.
 *
 * Det här är datumet formuläret förifyller. Null betyder att arrangören inte
 * har publicerat något datum som passar, och då ska fältet lämnas tomt så att
 * användaren kan skriva in datumet själv — aldrig förifyllas med ett datum som
 * redan har varit, för K-02 underkänner loppdatum före startdatumet.
 */
export function nextRaceDate(
  id: RacesConfig['races'][number]['id'],
  onOrAfter: string,
): string | null {
  return raceById(id).dates.find((datum) => datum >= onOrAfter) ?? null;
}
