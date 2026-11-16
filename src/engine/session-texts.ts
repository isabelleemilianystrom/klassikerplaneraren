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
import { intervalStructure, tempoStructure } from './session-structure.ts';
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
    instruction: instructionFor(session, text.instruction, week),
    alternatives: alternativesFor(session, input),
  };

  return withRaceNote(withSafetyNote(withSubstitution(grund, input), input));
}

/**
 * Instruktionen med passets egna tal ifyllda (F-10, R-10).
 *
 * Tröskel- och intervalltexterna är mallar: hur många block och hur långa de
 * är beror på hur många minuter passet faktiskt har. Förut stod "4 × 8
 * minuter" fast i texten, och ett pass på tjugo minuter bad då om något som
 * tog sextioen.
 *
 * Går strukturen inte att räkna fram är det ett fel, inte ett specialfall:
 * `session.minMinutes` är tjugo och tjugo minuter räcker till två block. Att
 * returnera mallen orörd skulle visa `{upp}` för användaren, vilket är värre
 * än felet modulen finns för. Därför kastas det i stället, och att det aldrig
 * händer är låst av ett test över alla profiler och 200 slumpade planer.
 */
function instructionFor(session: Session, mall: string, week: WeekSkeleton): string {
  if (session.type === 'strength') return mall + strengthExerciseNote(week);

  // Bara de hårda passen har en struktur att räkna fram. Övriga texter är
  // vanliga strängar utan platshållare och lämnas som de är.
  if (session.type !== 'tempo' && session.type !== 'intervals') return mall;

  const struktur =
    session.type === 'tempo' ? tempoStructure(session.minutes) : intervalStructure(session.minutes);

  if (struktur === null) {
    throw new Error(
      `Passet på ${session.minutes} minuter är för kort för en ${session.type}-struktur`,
    );
  }

  return mall
    .replace('{upp}', String(struktur.warmUp))
    .replace('{antal}', String(struktur.blocks))
    .replace('{block}', String(struktur.blockMinutes))
    .replace('{vila}', String(struktur.restMinutes))
    .replace('{ner}', String(struktur.coolDown));
}

/**
 * Övningarna i styrkepasset, som en mening (R-10).
 *
 * Instruktionen sa "kör övningarna i tur och ordning" utan att någonsin säga
 * vilka. Övningarna har funnits i `config/sessions.json` hela tiden — med en
 * egen lista per lopp — men ingen kod läste dem, och `strengthExercises` var
 * död konfiguration. Isabelles granskning av profilerna 2026-11-15 hittade
 * det: texten lovade en lista som aldrig visades.
 *
 * Loppets egen lista går före den allmänna. Inför Vasaloppet är överkroppen
 * det som avgör, och då ska rodd och dips stå där, inte utfallssteg.
 */
function strengthExerciseNote(week: WeekSkeleton): string {
  const { exercises, byRace } = sessionTexts.strengthExercises;
  const valda = (week.focusRaceId === null ? undefined : byRace[week.focusRaceId]) ?? exercises;

  return ` Övningarna: ${valda.map((övning) => övning.name).join(', ')}.`;
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
  // Styrkepasset är vikter på gymmet och har ingen gren att ersätta. I v0 ärvde
  // det veckans gren, och raden skrev ut "Längdskidor (stakmaskin) · Styrka" —
  // gymstyrka presenterad som stakmaskin. Här har det alltid haft sporten
  // 'strength', men spärren var en slump: `substitutions.bySport` råkar sakna
  // nyckeln. En rad i konfigurationen hade återinfört buggen.
  if (session.sport === null || session.sport === 'strength') return undefined;

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

  // F-11: ett hårt pass förlorade sin struktur när det ersattes. P5 hade 22
  // tröskelpass som blev "zon 4" i ett enda block på upp till 72 minuter,
  // vilket inte går att genomföra. Strukturen hör till träningen och inte till
  // platsen — den följer därför med, och ersättningens text läggs efter.
  const hårt = session.type === 'tempo' || session.type === 'intervals';
  const grund = hårt ? `${session.instruction} ` : '';

  return {
    ...session,
    title: text.title,
    instruction: grund + text.instruction + splitNoteFor(vald, text, session.minutes),
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

  // Samma skäl som i `substituteFor`: styrkepasset har ingen gren, så det har
  // inga alternativa grenar heller. Skyddades förut bara av att
  // `sessionAlternatives.forTypes` inte listar 'strength'.
  if (session.sport === null || session.sport === 'strength') return [];
  if (!regler.forTypes.includes(session.type)) return [];

  const månad = monthOf(session.date);

  const gren = session.sport;

  const grenar = regler.interchangeable
    .filter((kandidat): kandidat is TrainedSport => kandidat !== gren)
    .filter((kandidat) => inSeason(kandidat, månad))
    .filter((kandidat) => hasEquipmentFor(kandidat, input, session.date))
    .map((kandidat) => ({
      sport: kandidat,
      title: alternativeTitle(kandidat, session.type),
      note: regler.notes[kandidat] ?? '',
    }));

  return [...grenar, ...equipmentAlternativesFor(gren, session, input)];
}

/**
 * Redskapen passet också går att göra med (R-37).
 *
 * Samma gren, samma tid, samma zon — ett annat redskap. Stakmaskinen är det
 * R-17 väljer när snön fattas, men den som har en kan vilja använda den en dag
 * när spåret inte går att åka, och då ska den stå i planen.
 *
 * Förut gjorde den inte det: svarade användaren ja på snö nämnde inget av 74
 * skidpass stakmaskinen, eftersom nästan all skidträning ligger i
 * november–mars och R-17 bara ersätter när snön saknas. Rutan i formuläret
 * kunde alltså inte påverka något.
 *
 * Erbjuds bara när passet går att genomföra i redskapet: R-44:s tak gäller
 * lika mycket för ett erbjudande som för en ersättning, så ett långpass på två
 * och en halv timme får inget stakmaskinsalternativ.
 *
 * Ett pass som redan *är* en ersättning får inga alternativ alls — det rensar
 * `withSubstitution`, och därför står det aldrig "Stakmaskin (om spåret inte
 * går att åka)" på ett pass som redan görs i stakmaskinen.
 */
function equipmentAlternativesFor(
  sport: TrainedSport,
  session: Session,
  input: PlanInput,
): SessionAlternative[] {
  const utrustning = input.equipment as Record<string, boolean>;
  const alternativ: SessionAlternative[] = [];

  for (const variant of rules.sessionAlternatives.equipmentVariants[sport] ?? []) {
    const regel = substituteRuleFor(sport, variant.key);

    if (!regel.needs.every((flagga) => utrustning[flagga] === true)) continue;
    if (regel.maxMinutes !== undefined && session.minutes > regel.maxMinutes) continue;

    const text = sessionTexts.substitutes[variant.key];
    if (text === undefined) {
      throw new Error(`config/sessions.json saknar ersättningen "${variant.key}"`);
    }

    alternativ.push({
      sport,
      title: text.title,
      note: variant.note,
      substitutedAs: variant.key,
    });
  }

  return alternativ;
}

/**
 * Ersättningen med den nyckeln ur R-17:s prioritetsordning.
 *
 * Utrustningskravet och R-44:s tak står där, och ska stå på ett enda ställe:
 * ett alternativ med egna siffror skulle kunna erbjuda det R-17 säger nej till.
 */
function substituteRuleFor(
  sport: TrainedSport,
  key: string,
): { needs: readonly string[]; maxMinutes?: number | undefined } {
  const regel = rules.substitutions.bySport[sport]?.find((kandidat) => kandidat.key === key);
  if (regel === undefined) {
    throw new Error(`config/rules.json saknar ersättningen "${key}" för grenen "${sport}"`);
  }

  return regel;
}

/** Alternativets titel, med grenens egen variant om det finns en. */
function alternativeTitle(sport: TrainedSport, type: SessionType): string {
  const variant = sessionTexts.sportVariants[`${sport}.${type}`];
  return variant?.title ?? (sessionTexts.types[type]?.title ?? type);
}
