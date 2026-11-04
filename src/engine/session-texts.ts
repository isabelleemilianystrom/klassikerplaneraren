/**
 * Passens texter: titel, instruktion, ersättning, säkerhetstext och alternativ
 * (R-17, R-19, R-20, R-30, R-37, R-44).
 *
 * Här får ett pass sitt språk. Motorn har redan bestämt gren, längd, zon och
 * dag — den här modulen säger vad det heter och hur det görs, och väljer
 * ersättning när grenen inte går att göra som den är.
 *
 * **Svenska strängar hämtas ur `config/sessions.json`**, aldrig ur koden.
 * Motorn hanterar nycklar, inte färdiga meningar.
 */
import { rules, sessions as sessionTexts } from './config.ts';
import { monthOf } from './dates.ts';
import { hasEquipmentFor, hasSnow, inSeason, isOpenWater, isWinter } from './season.ts';
import type {
  PlanInput,
  Session,
  SessionAlternative,
  SessionType,
  TrainedSport,
} from './types.ts';
import type { WeekSkeleton } from './weeks.ts';

/**
 * Den text som ligger närmast passet, eller undefined för den allmänna (R-30).
 *
 * Styrkan viktas mot veckans fokuslopp där grenen kräver det: inför Vasaloppet
 * mot överkropp och bål, eftersom stakningen kommer därifrån (R-10).
 *
 * Grenspecifika varianter går före den allmänna texten. Simteknik beskrivs
 * inte som skidteknik, och ett långpass i terräng inte som ett på asfalt.
 */
function textVariantFor(
  session: Session,
  week: WeekSkeleton,
): { title: string; instruction: string } | undefined {
  if (session.type === 'strength') {
    return week.focusRaceId === null
      ? undefined
      : sessionTexts.strengthVariants.byRace[week.focusRaceId];
  }

  if (session.sport === null) return undefined;
  return sessionTexts.sportVariants[`${session.sport}.${session.type}`];
}

/**
 * Titel och instruktion från `config/sessions.json` (R-30).
 *
 * Sportspecifika varianter går före den allmänna texten: simteknik beskrivs
 * inte som skidteknik. Saknas en kombination är det ett fel i konfigurationen
 * och ska märkas som ett kastat undantag, inte som ett tomt fält.
 */
export function withTitleAndInstruction(
  session: Session,
  week: WeekSkeleton,
  index: number,
  input: PlanInput,
): Session {
  const variant = textVariantFor(session, week);
  const allmän = sessionTexts.types[session.type];

  const text = variant ?? allmän;
  if (text === undefined) {
    throw new Error(
      `config/sessions.json saknar text för passtypen "${session.type}"` +
        ` (vecka ${week.index}, pass ${index + 1})`,
    );
  }

  const grund: Session = {
    ...session,
    title: text.title,
    instruction: text.instruction,
    alternatives: alternativesFor(session, input),
  };

  return withRaceNote(withSafetyNote(withSubstitution(grund, input), input));
}

/**
 * Lopptaktiken på loppdagen (R-30).
 *
 * Råd som hör till loppet och inte till träningen: motströmmen i Vanån,
 * klungan i Vätternrundan, att Lidingöloppet avgörs på sista milen. De
 * tränar man inte, man förhåller sig till dem — därför står de bara här,
 * och bara på loppdagen.
 */
export function withRaceNote(session: Session): Session {
  if (session.type !== 'race' || session.raceId === undefined) return session;

  const taktik = sessionTexts.raceNotes.byRace[session.raceId];
  if (taktik === undefined) return session;

  return { ...session, instruction: `${session.instruction} ${taktik}` };
}

/**
 * Passet gjort på ett annat sätt när utrustningen saknas (R-17, R-18, R-20).
 *
 * Skidor utan snö eller rullskidor blir stakmaskin om användaren har en,
 * annars stavgång i backe. Simning utan simhall blir torrövningar. Cykel utan
 * cykel blir spinning. Tid och zon är oförändrade — det är hur passet görs som
 * ändras, inte vad det ska ge.
 *
 * Loppet ersätts aldrig: den som anmält sig till Vasaloppet åker Vasaloppet.
 * Simning i öppet vatten juni till augusti kräver ingen simhall (R-19).
 */
/**
 * Tillägget som delar ett för långt ersättningspass (R-44).
 *
 * Ett långpass på två och en halv timme i stakmaskin är samma rörelse hela
 * vägen. Passet behåller sin tid — skidträningen behövs — men instruktionen
 * säger hur den delas. Det blir inget andra pass av det: en dag bär ett pass
 * (R-42), och det här är ett pass som görs på två sätt.
 */
function splitNoteFor(
  substitute: { maxMinutes?: number | undefined; overflowKey?: string | undefined },
  text: { splitNote?: string | undefined },
  minutes: number,
): string {
  const { maxMinutes, overflowKey } = substitute;
  if (maxMinutes === undefined || overflowKey === undefined) return '';
  if (text.splitNote === undefined || minutes <= maxMinutes) return '';

  const resten = sessionTexts.substitutes[overflowKey];
  if (resten === undefined) {
    throw new Error(`config/sessions.json saknar ersättningen "${overflowKey}"`);
  }

  return text.splitNote
    .replace('{minutes}', String(minutes - maxMinutes))
    .replace('{other}', resten.title.toLowerCase());
}

/**
 * Ersättningen passet ska göras som, eller undefined (R-17, R-20).
 *
 * Två olika fall, och de är inte samma sak:
 *
 *  1. **Grenen går inte att göra som den är.** Det gäller skidor utanför
 *     vintern: utan snö blir passet rullskidor om användaren har dem, annars
 *     stakmaskin, annars stavgång i backe. Alla tre är skidträning och passet
 *     behåller grenen — stavgång i backe är hur man tränar för Vasaloppet där
 *     det inte finns snö, inte en nödlösning.
 *  2. **Samma träning på en annan plats.** Det gäller cykeln under vintern:
 *     har användaren en trainer eller kommer åt spinning görs passet inomhus.
 *     Saknas den planeras det som vanligt cykelpass — alla som gör en
 *     klassiker har cykel, så det finns inget att ersätta.
 */
interface Substitute {
  key: string;
  maxMinutes?: number | undefined;
  overflowKey?: string | undefined;
  /** Sant för en säsongsvariant: samma gren, annan plats (R-20). */
  sameSport: boolean;
}

function substituteFor(session: Session, input: PlanInput): Substitute | undefined {
  if (session.sport === null) return undefined;

  const utrustning = input.equipment as Record<string, boolean>;
  const har = (flaggor: readonly string[]): boolean =>
    flaggor.every((flagga) => utrustning[flagga] === true);

  // Fall 2: säsongsvarianten.
  if (isWinter(session.date)) {
    const variant = rules.substitutions.seasonVariants.inWinter[session.sport];
    if (variant !== undefined && har(variant.needs)) return { ...variant, sameSport: true };
  }

  // Fall 1: grenen kräver snö, och snö finns inte.
  const snögrenar: readonly string[] = rules.substitutions.snowSports;
  if (!snögrenar.includes(session.sport) || hasSnow(session.date, input)) return undefined;

  const kandidater = rules.substitutions.bySport[session.sport];
  const vald = kandidater?.find((kandidat) => har(kandidat.needs));

  return vald === undefined ? undefined : { ...vald, sameSport: false };
}

export function withSubstitution(session: Session, input: PlanInput): Session {
  if (session.sport === null || session.type === 'race' || session.type === 'rest') {
    return session;
  }
  const vald = substituteFor(session, input);
  if (vald === undefined) return session;

  const text = sessionTexts.substitutes[vald.key];
  if (text === undefined) {
    throw new Error(`config/sessions.json saknar ersättningen "${vald.key}"`);
  }

  return {
    ...session,
    title: text.title,
    instruction: text.instruction + splitNoteFor(vald, text, session.minutes),
    substitutedAs: vald.key,
    // En riktig ersättning är redan ett byte av gren. Att dessutom lista
    // alternativ skulle ge tre sätt att göra samma pass, vilket är ett för
    // många. En säsongsvariant är däremot samma gren på en annan plats — ett
    // cykelpass inomhus är fortfarande ett cykelpass, och alternativen till
    // det är lika giltiga som ute.
    alternatives: vald.sameSport ? session.alternatives : [],
  };
}

/**
 * Säkerhetstexten för öppet vatten (R-19).
 *
 * Varje pass i öppet vatten bär den, ordagrant enligt kravspecens avsnitt 8.
 * Loppet undantas inte: Vansbrosimningen *är* öppet vatten.
 */
export function withSafetyNote(session: Session, input: PlanInput): Session {
  if (session.sport === null) return session;
  if (session.type === 'rest') return session;
  if (session.substitutedAs !== undefined) return session;
  if (!isOpenWater(session.sport, session.date)) return session;

  void input;
  return { ...session, safetyNote: sessionTexts.safetyNotes.openWater.text };
}

/**
 * Grenarna passet också kan göras i (R-37).
 *
 * Träningsupplägget är långpass, intervaller och styrka — inte fyra separata
 * sporter. Grenen som står på passet är den som passar nästa lopp bäst, men
 * flera grenar ger samma konditionsträning, och den som hellre vill byta ska
 * kunna göra det utan att tappa poängen med passet.
 *
 * Ett alternativ krävs vara möjligt att faktiskt genomföra: grenen måste vara
 * i säsong, och användaren måste ha utrustningen. Att föreslå längdskidor i
 * juli, eller till någon utan skidor, gör planen otrovärdig.
 *
 * Loppet, vilan, styrkan och teknikpassen har inga alternativ. Ett teknikpass
 * i simning kan inte bytas mot cykel — då är det inte längre samma pass.
 */
export function alternativesFor(session: Session, input: PlanInput): SessionAlternative[] {
  const regler = rules.sessionAlternatives;

  if (session.sport === null) return [];
  if (!regler.forTypes.includes(session.type)) return [];

  const månad = monthOf(session.date);

  return regler.interchangeable
    .filter((kandidat): kandidat is TrainedSport => kandidat !== session.sport)
    .filter((kandidat) => inSeason(kandidat, månad))
    .filter((kandidat) => hasEquipmentFor(kandidat, input, session.date))
    .map((kandidat) => ({
      sport: kandidat,
      title: alternativeTitle(kandidat, session.type),
      note: regler.notes[kandidat] ?? '',
    }));
}

/** Alternativets titel, med grenens egen variant om det finns en. */
function alternativeTitle(sport: TrainedSport, type: SessionType): string {
  const variant = sessionTexts.sportVariants[`${sport}.${type}`];
  return variant?.title ?? (sessionTexts.types[type]?.title ?? type);
}
