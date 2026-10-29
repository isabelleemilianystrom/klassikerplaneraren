/**
 * Alla svenska texter i gränssnittet.
 *
 * Samlade här och inte utspridda i logiken, så att de går att läsa, granska och
 * rätta på ett ställe. Motorn hanterar nycklar och siffror; den här filen är
 * det enda stället som vet hur något formuleras på svenska.
 *
 * **Texterna i `FIXED` är ordagranna ur kravspecens avsnitt 8.** De handlar om
 * hälsa och säkerhet och får inte ändras utan att Isabelle godkänner det.
 */
import { races } from '../engine/config.ts';
import type { Level, RaceId, TrainedSport, Weekday } from '../engine/types.ts';

/** Texterna ur avsnitt 8. Ändras inte. */
export const FIXED = {
  disclaimer:
    'Klassikerplaneraren är en beta och ger allmänna träningsförslag, inte medicinska råd. ' +
    'Har du en sjukdom eller skada, är gravid eller osäker på om du tål hård träning – prata ' +
    'med vården innan du börjar.',
  ageLimit: 'För dig som är 18 år eller äldre.',
  redFlags:
    'Avbryt passet och sök vård om du får bröstsmärta, ovanlig andfåddhet, yrsel eller ' +
    'oregelbunden puls.',
  painRule:
    'Träningsvärk som går över på ett par dagar är normalt. Gör det ont mer och mer, haltar du ' +
    'eller sitter smärtan kvar nästa dag – vila den sporten och byt till något skonsammare.',
  illness: 'Har du feber – vila. Börja sedan lugnt och ta inte igen missade pass.',
  aiMarking: 'Förklaringarna är skrivna med hjälp av AI.',
  independence:
    'Klassikerplaneraren är inte knuten till Vasaloppet, Vätternrundan, Vansbrosimningen, ' +
    'Lidingöloppet eller En svensk klassiker.',
} as const;

/** Grenarnas namn, som de skrivs i löpande text. */
export const SPORT_NAMES: Record<TrainedSport | 'strength', string> = {
  ski: 'Längdskidor',
  bike: 'Cykel',
  swim: 'Simning',
  run: 'Löpning',
  strength: 'Styrka',
};

/** Nivåernas beskrivningar, ordagrant ur avsnitt 5. */
export const LEVELS: { value: Level; name: string; description: string }[] = [
  {
    value: 'new',
    name: 'Ny',
    description: 'Jag har knappt provat sporten eller kan inte tekniken, t.ex. simmar inte crawl',
  },
  {
    value: 'experienced',
    name: 'Van',
    description: 'Jag tränar sporten ibland och klarar en lugn timme',
  },
  {
    value: 'advanced',
    name: 'Erfaren',
    description: 'Jag tränar sporten regelbundet och har gjort lopp förut',
  },
];

/** Veckodagarna, måndag först. */
export const WEEKDAYS: { value: Weekday; name: string }[] = [
  { value: 1, name: 'Måndag' },
  { value: 2, name: 'Tisdag' },
  { value: 3, name: 'Onsdag' },
  { value: 4, name: 'Torsdag' },
  { value: 5, name: 'Fredag' },
  { value: 6, name: 'Lördag' },
  { value: 7, name: 'Söndag' },
];

/** Utrustningsfrågorna i steg 3. */
export const EQUIPMENT: { key: string; label: string; help: string }[] = [
  {
    key: 'snowOrRollerSkis',
    label: 'Snö eller rullskidor',
    help: 'Kommer du åt ett spår på vintern, eller har du rullskidor?',
  },
  { key: 'skiErg', label: 'Stakmaskin', help: 'Finns det en på gymmet du använder?' },
  { key: 'pool', label: 'Simhall', help: 'Kommer du åt en bassäng regelbundet?' },
  {
    key: 'bike',
    label: 'Landsvägscykel eller trainer',
    help: 'Egen cykel, eller en trainer att cykla inomhus på.',
  },
];

/** Loppens namn och distanser, hämtade ur konfigurationen. */
export function raceLabel(id: RaceId): string {
  const race = races.races.find((kandidat) => kandidat.id === id);
  if (race === undefined) throw new Error(`Loppet ${id} finns inte`);
  return `${race.name} – ${race.distanceKm} km ${SPORT_NAMES[race.sport as TrainedSport].toLowerCase()}`;
}

/** Startsidan. */
export const HOME = {
  title: 'Klassikerplaneraren',
  lead:
    'Ett träningsprogram vecka för vecka fram till dina lopp i En svensk klassiker: Vasaloppet, ' +
    'Vätternrundan, Vansbrosimningen och Lidingöloppet.',
  body:
    'Du svarar på några frågor om vilka lopp du ska göra, hur van du är i varje gren och hur ' +
    'mycket tid du har. Sedan får du ett program som fasar in grenarna över året och toppar ' +
    'formen mot varje lopp.',
  beta: 'Det här är en beta. Programmet är ett förslag, och du känner din kropp bäst.',
  start: 'Skapa mitt program',
} as const;

/** Formuläret. */
export const FORM = {
  stepLabel: (steg: number, av: number) => `Steg ${steg} av ${av}`,

  step1: {
    heading: 'Vilka lopp ska du göra?',
    lead: 'Välj minst ett. Du behöver inte göra alla fyra för att få ett program.',
    startDateLabel: 'Första träningsdagen',
    startDateHelp: 'Förvalt är i dag. Programmet börjar på måndagen i den veckan.',
    dateLabel: 'Datum',
    goalLabel: 'Vad vill du med loppet?',
    goals: [
      {
        value: 'finish' as const,
        name: 'Ta mig i mål',
        help: 'Jag vill genomföra loppet. Tiden spelar mindre roll.',
      },
      {
        value: 'time' as const,
        name: 'Sikta på en tid',
        help: 'Jag har en tid i huvudet och vill träna för den.',
      },
    ],
    goalHelp:
      'Svaret styr hur mycket tid grenen får. Vill du bara ta dig i mål räcker det med att bli trygg och hålla tekniken — då går tiden till de lopp du siktar på i stället.',
    datePlaceholderMissing: 'Arrangören har inte publicerat något datum som passar – skriv in det själv',
    errors: {
      noRace: 'Välj minst ett lopp för att komma vidare.',
      dateMissing: 'Ange ett datum för loppet.',
      dateBeforeStart: 'Loppet kan inte gå före din första träningsdag.',
      dateInvalid: 'Skriv datumet som ÅÅÅÅ-MM-DD.',
      startDateInvalid: 'Skriv datumet som ÅÅÅÅ-MM-DD.',
    },
  },

  step2: {
    heading: 'Hur van är du i varje gren?',
    lead:
      'Det avgör hur mycket tid grenen får och hur hårt du tränar i den. Var hellre försiktig ' +
      'än optimistisk – programmet blir bättre av ett ärligt svar.',
    error: 'Välj en nivå för varje gren.',
  },

  step3: {
    heading: 'Hur mycket tid har du?',
    hoursLabel: 'Timmar i veckan',
    hoursHelp:
      'Räkna med all träning, styrka inräknad. Det här är din toppvecka – de flesta veckor blir ' +
      'kortare, eftersom programmet varvar tyngre och lättare perioder.',
    longSessionLabel: 'Vilken dag passar för veckans långpass?',
    longSessionHelp: 'Det längsta passet i veckan. Välj en dag du brukar ha tid.',
    restLabel: 'Vilken dag vill du vara helt ledig?',
    restHelp: 'Den dagen läggs ingen träning. Vilan är en del av programmet.',
    equipmentHeading: 'Vad har du tillgång till?',
    equipmentHelp:
      'Svara nej om du är osäker. Saknas något byter programmet ut passet mot något som ger ' +
      'samma träning – skidor blir till exempel stavgång i backe.',
    errors: {
      sameDay: 'Långpasset och vilodagen kan inte vara samma dag.',
      hours: 'Välj mellan 3 och 15 timmar.',
    },
  },

  back: 'Tillbaka',
  next: 'Nästa',
  submit: 'Skapa programmet',
} as const;

/** Planvyn. */
export const PLAN = {
  heading: 'Ditt träningsprogram',

  summary: (veckor: number, timmar: number, perVecka: number) =>
    `${veckor} veckor och totalt ${timmar} timmar, utifrån ${perVecka} timmar i veckan. ` +
    `De flesta veckor blir kortare än så – programmet varvar tyngre och lättare perioder.`,

  warningsHeading: 'Att tänka på',
  safetyHeading: 'Innan du börjar',
  overviewHeading: 'Vecka för vecka',

  weekNumber: (nummer: number) => `v. ${nummer}`,
  currentWeek: 'Nu',
  deload: 'lättare vecka',

  phaseWeeks: (antal: number) => `${antal} ${antal === 1 ? 'vecka' : 'veckor'}`,

  raceWeek: (lopp: string[]) => (lopp.length === 1 ? `${lopp[0]}` : lopp.join(' och ')),

  rest: 'Vila – ingen planerad träning.',

  alternatives: (grenar: string[]) => `Kan också göras som: ${grenar.join(', ')}`,

  changeAnswers: 'Ändra svar',
} as const;

/**
 * Lagringen (K-10, K-15).
 *
 * Texten när en sparad plan kastas ska förklara vad som hände utan att skylla
 * på användaren, och säga vad hon kan göra: fylla i formuläret igen.
 */
export const STORAGE = {
  discarded: (reason: string): string => {
    const skäl =
      reason === 'old-version'
        ? 'Den sparades med en äldre version av appen.'
        : 'Den gick inte att läsa.';

    return `Du hade ett sparat program, men det kunde inte öppnas. ${skäl} ` +
      'Svara på frågorna igen så gör vi ett nytt – det tar ett par minuter.';
  },

  startOver: 'Gör en ny plan',

  startOverConfirm:
    'Det här tar bort ditt sparade program. Du svarar på frågorna igen och får ett nytt.',
} as const;