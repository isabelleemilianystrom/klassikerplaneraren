/**
 * Skriver ut referensprofilernas planer som läsbar text.
 *
 * Det här är verktyget Isabelle granskar planerna med vid M1, innan
 * gränssnittet finns. Körs med `npm run profiles`.
 *
 * Filerna hamnar i `profiles/`, en per profil, plus en översikt. Katalogen är
 * ignorerad av git — texten är genererad och hör inte i repot.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { raceById, rules } from '../src/engine/config.ts';
import { weekdayOf } from '../src/engine/dates.ts';
import { buildWeekPlans, type WeekPlan } from '../src/engine/sessions.ts';
import { volumeChecks, volumeWarnings } from '../src/engine/volume.ts';
import { courseAdvice, midProgrammeStarts, midProgrammeWarnings } from '../src/engine/warnings.ts';
import type { PlanInput, Session, Zone } from '../src/engine/types.ts';
import { EQUIPMENT } from '../src/ui/texts.ts';
import { PROFILES } from '../tests/profiles.ts';

const DAGNAMN = ['', 'mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön'] as const;

const FASNAMN = {
  base: 'Bas',
  specific: 'Specifik',
  taper: 'Nedtrappning',
  recovery: 'Återhämtning',
} as const;

const SPORTNAMN = {
  ski: 'Längdskidor',
  bike: 'Cykel',
  swim: 'Simning',
  run: 'Löpning',
  strength: 'Styrka',
} as const;

/** Minuter som "1 h 35 min", eller "45 min" när det är under en timme. */
function tid(minuter: number): string {
  if (minuter < 60) return `${minuter} min`;
  const timmar = Math.floor(minuter / 60);
  const rest = minuter % 60;
  return rest === 0 ? `${timmar} h` : `${timmar} h ${rest} min`;
}

function zonText(zone: Zone | null, sport: Session['sport']): string {
  if (zone === null) return '';

  const nyckel = String(zone) as '1';
  const text =
    sport === 'swim'
      ? rules.intensity.zoneTextBySport.swim[nyckel]
      : rules.intensity.zoneText[nyckel];

  return `zon ${zone} (${text})`;
}

/** Profilens indata i ord, så att en plan går att läsa utan att öppna koden. */
function beskrivProfil(namn: string, input: PlanInput): string[] {
  const lopp = [...input.races]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((race) => `${raceById(race.id).name} ${race.date}`)
    .join(', ');

  const nivåer = Object.entries(input.levels)
    .map(([sport, nivå]) => `${SPORTNAMN[sport as 'ski']}: ${nivå}`)
    .join(', ');

  // Etiketterna ur formuläret, inte nycklarna. Den som läser filen ska se
  // samma ord som användaren svarade på.
  const utrustning =
    Object.entries(input.equipment)
      .filter(([, har]) => har)
      .map(([nyckel]) => EQUIPMENT.find((fråga) => fråga.key === nyckel)?.label ?? nyckel)
      .join(', ') || 'ingen';

  return [
    `${namn}`,
    '='.repeat(namn.length),
    '',
    `Startdatum        ${input.startDate}`,
    `Lopp              ${lopp}`,
    `Nivåer            ${nivåer}`,
    `Timmar per vecka  ${input.hoursPerWeek}`,
    `Långpass          ${DAGNAMN[input.preferredDays.longSession]}`,
    `Vilodag           ${DAGNAMN[input.preferredDays.rest]}`,
    `Utrustning        ${utrustning}`,
    '',
  ];
}

/** En vecka med rubrik, pass och dagar. */
function skrivVecka(plan: WeekPlan): string[] {
  const { week, budget } = plan;
  const fokus = week.focusRaceId === null ? '' : ` mot ${raceById(week.focusRaceId).name}`;
  const avlastning = week.isDeload ? ', avlastningsvecka' : '';

  const rader = [
    `Vecka ${week.index} — ${week.startDate}`,
    `  ${FASNAMN[week.phase]}${fokus}${avlastning}`,
    `  Planerad tid ${tid(plan.totalMinutes)}` +
      (budget.raceMinutes > 0 ? ` varav lopp ${tid(budget.raceMinutes)}` : ''),
    '',
  ];

  for (const session of plan.sessions) {
    const dag = `${DAGNAMN[weekdayOf(session.date)]} ${session.date.slice(8)}/${session.date.slice(5, 7)}`;

    if (session.type === 'rest') {
      rader.push(`  ${dag.padEnd(12)} Vila`);
      continue;
    }

    // Grenen står kvar också när passet görs på ett annat sätt. "Stavgång i
    // backe — Längdskidor" är inte en motsägelse: bor man där det inte finns
    // snö är det så man tränar för Vasaloppet, och det är bra träning.
    const sport = session.sport === null ? '' : SPORTNAMN[session.sport];
    const zon = zonText(session.zone, session.sport);

    rader.push(
      `  ${dag.padEnd(12)} ${tid(session.minutes).padEnd(10)} ${session.title}` +
        (sport === '' ? '' : ` — ${sport}`) +
        (zon === '' ? '' : `, ${zon}`),
    );
    rader.push(`  ${' '.repeat(12)} ${session.instruction}`);

    // R-19: säkerhetstexten för öppet vatten.
    if (session.safetyNote !== undefined) {
      rader.push(`  ${' '.repeat(12)} OBS: ${session.safetyNote}`);
    }

    // R-37: grenarna passet också kan göras i.
    if (session.alternatives.length > 0) {
      const alternativ = session.alternatives
        .map((a) => (a.note === '' ? SPORTNAMN[a.sport] : `${SPORTNAMN[a.sport]} (${a.note})`))
        .join(', ');
      rader.push(`  ${' '.repeat(12)} Kan också göras som: ${alternativ}`);
    }
  }

  rader.push('');
  return rader;
}

/**
 * En rad per vecka: fas, tid och minuterna som faktiskt blev pass.
 *
 * Kolumnerna räknas ur **passen**, inte ur budgeten. Budgeten säger vad grenen
 * tilldelades innan passen byggdes, och sedan R-40 och R-42 flyttas minuter
 * mellan grenar efter det: ett golv fylls på från andra grenar, en gren som
 * inte rymmer ett helt pass får noll, och det som inte får plats redovisas som
 * oplacerad tid. Tidigare skrev den här tabellen ut budgeten, och då stämde
 * två tredjedelar av siffrorna inte med veckan längre ner i filen — en gren
 * kunde visa tid utan att ha ett enda pass.
 *
 * **Loppveckan går ihop sedan 2026-11-16** (fynd F-21). Förut låg loppet och
 * öppningspasset utanför alla kolumner medan tidskolumnen räknade med dem, så
 * en loppvecka saknade upp till 445 minuter utan att något sa varför. Nu
 * ligger öppningspasset i sin grens kolumn — det är ett träningspass som alla
 * andra — och loppet har en egen kolumn. Raden stämmer:
 *
 *     tid = skidor + cykel + simning + löpning + styrka + lopp
 *
 * Den oplacerade tiden står utanför den summan: det är budget som aldrig blev
 * något pass.
 */
function skrivÖversikt(input: PlanInput, planer: readonly WeekPlan[]): string[] {
  void input;

  const rader = [
    'Översikt',
    '--------',
    '',
    '  Minuterna är passens, inte budgetens. "oplac." är tid som inte fick plats (R-29).',
    '  Raden går ihop: tid = skidor + cykel + simning + löpning + styrka + lopp.',
    '',
    '  I en loppvecka är konditionsbudgeten liten — R-25 har redan räknat av loppet som',
    '  veckans belastning — och de minuter som blir över är smulor under ett passgolv.',
    '  Tio oplacerade minuter i en vecka med ett lopp på tre och en halv timme är alltså',
    '  väntat, inte ett fel.',
    '',
    '  v  datum       fas            tid         skidor  cykel   simning löpning styrka  lopp    oplac.',
  ];

  for (const plan of planer) {
    // Öppningspasset hör till sin gren: det är tjugo till trettio minuter
    // lugn träning dagen före loppet, inte en del av loppet.
    const träning = plan.sessions.filter(
      (session) => session.type !== 'rest' && session.type !== 'race',
    );

    const loppminuter = plan.sessions
      .filter((session) => session.type === 'race')
      .reduce((summa, session) => summa + session.minutes, 0);

    const minuterI = (gren: string): number =>
      träning
        .filter((session) => session.sport === gren)
        .reduce((summa, session) => summa + session.minutes, 0);

    const kol = (minuter: number) => (minuter === 0 ? '-' : String(minuter)).padEnd(8);

    rader.push(
      `  ${String(plan.week.index).padStart(2)} ${plan.week.startDate}  ` +
        `${FASNAMN[plan.week.phase].padEnd(14)} ${tid(plan.totalMinutes).padEnd(12)}` +
        kol(minuterI('ski')) +
        kol(minuterI('bike')) +
        kol(minuterI('swim')) +
        kol(minuterI('run')) +
        kol(minuterI('strength')) +
        kol(loppminuter) +
        (plan.budget.unplacedMinutes === 0 ? '-' : String(plan.budget.unplacedMinutes)),
    );
  }

  rader.push('');
  return rader;
}

function main(): void {
  mkdirSync('profiles', { recursive: true });

  const sammanfattning: string[] = ['Referensprofiler', '================', ''];

  for (const [namn, input] of Object.entries(PROFILES)) {
    const planer = buildWeekPlans(input);

    const checks = volumeChecks(input, planer);

    const varningar = [
      ...midProgrammeWarnings(midProgrammeStarts(input, planer)),
      ...courseAdvice(input),
    ];
    const varningsrader =
      varningar.length === 0
        ? []
        : ['Varningar', '---------', '', ...varningar.map((v) => `  ${v}`), ''];

    const riktmärken =
      checks.length === 0
        ? []
        : [
            'Volymriktmärken (R-34)',
            '-----------------------',
            '',
            ...checks.map(
              (check) =>
                `  ${raceById(check.raceId).name}: ${Math.round(check.minutes / 60)} h ` +
                `≈ ${check.kilometers} km av ${check.milestoneKm} km` +
                `${check.reached ? '  (nått)' : '  (nås inte)'}`,
            ),
            '',
            ...volumeWarnings(checks).map((varning) => `  ${varning}`),
            '',
          ];

    const text = [
      ...beskrivProfil(namn, input),
      ...varningsrader,
      ...riktmärken,
      ...skrivÖversikt(input, planer),
      'Vecka för vecka',
      '---------------',
      '',
      ...planer.flatMap((plan) => skrivVecka(plan)),
    ].join('\n');

    const fil = `profiles/${namn}.txt`;
    writeFileSync(fil, text, 'utf8');

    const totalt = planer.reduce((summa, plan) => summa + plan.totalMinutes, 0);
    sammanfattning.push(
      `${namn.padEnd(4)} ${String(planer.length).padStart(2)} veckor, ` +
        `${input.hoursPerWeek} h/vecka, totalt ${Math.round(totalt / 60)} h  →  ${fil}`,
    );
  }

  writeFileSync('profiles/oversikt.txt', sammanfattning.join('\n') + '\n', 'utf8');

  // Enda stället i projektet där utskrift till terminalen är meningen.
  console.log(sammanfattning.join('\n'));
}

main();
