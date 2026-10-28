/**
 * Skriver ut referensprofilernas planer som läsbar text.
 *
 * Det här är verktyget Isabelle granskar planerna med vid M1, innan
 * gränssnittet finns. Körs med `npm run profiles`.
 *
 * Filerna hamnar i `out/`, en per profil, plus en översikt. Katalogen är
 * ignorerad av git — texten är genererad och hör inte i repot.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { weekBudgets } from '../src/engine/budget.ts';
import { raceById, rules } from '../src/engine/config.ts';
import { weekdayOf } from '../src/engine/dates.ts';
import { buildWeekPlans, type WeekPlan } from '../src/engine/sessions.ts';
import { volumeChecks, volumeWarnings } from '../src/engine/volume.ts';
import { midProgrammeStarts, midProgrammeWarnings } from '../src/engine/warnings.ts';
import type { PlanInput, Zone } from '../src/engine/types.ts';
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

function zonText(zone: Zone | null): string {
  if (zone === null) return '';
  return `zon ${zone} (${rules.intensity.zoneText[String(zone) as '1']})`;
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

  const utrustning =
    Object.entries(input.equipment)
      .filter(([, har]) => har)
      .map(([namn]) => namn)
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

    const sport = session.sport === null ? '' : SPORTNAMN[session.sport];
    const zon = zonText(session.zone);

    rader.push(
      `  ${dag.padEnd(12)} ${tid(session.minutes).padEnd(10)} ${session.title}` +
        (sport === '' ? '' : ` — ${sport}`) +
        (zon === '' ? '' : `, ${zon}`),
    );
    rader.push(`  ${' '.repeat(12)} ${session.instruction}`);
  }

  rader.push('');
  return rader;
}

/** En rad per vecka: fas, tid och fördelning mellan sporterna. */
function skrivÖversikt(input: PlanInput, planer: readonly WeekPlan[]): string[] {
  const budgetar = weekBudgets(input);

  const rader = [
    'Översikt',
    '--------',
    '',
    '  v  datum       fas            tid         skidor  cykel   simning löpning styrka',
  ];

  for (const [i, plan] of planer.entries()) {
    const b = budgetar[i];
    if (b === undefined) continue;

    const kol = (minuter: number | undefined) =>
      (minuter === undefined || minuter === 0 ? '-' : String(minuter)).padEnd(8);

    rader.push(
      `  ${String(plan.week.index).padStart(2)} ${plan.week.startDate}  ` +
        `${FASNAMN[plan.week.phase].padEnd(14)} ${tid(plan.totalMinutes).padEnd(12)}` +
        kol(b.bySport.ski) +
        kol(b.bySport.bike) +
        kol(b.bySport.swim) +
        kol(b.bySport.run) +
        kol(b.strengthMinutes),
    );
  }

  rader.push('');
  return rader;
}

function main(): void {
  mkdirSync('out', { recursive: true });

  const sammanfattning: string[] = ['Referensprofiler', '================', ''];

  for (const [namn, input] of Object.entries(PROFILES)) {
    const planer = buildWeekPlans(input);

    const checks = volumeChecks(input, planer);

    const varningar = midProgrammeWarnings(midProgrammeStarts(input, planer));
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

    const fil = `out/${namn}.txt`;
    writeFileSync(fil, text, 'utf8');

    const totalt = planer.reduce((summa, plan) => summa + plan.totalMinutes, 0);
    sammanfattning.push(
      `${namn.padEnd(4)} ${String(planer.length).padStart(2)} veckor, ` +
        `${input.hoursPerWeek} h/vecka, totalt ${Math.round(totalt / 60)} h  →  ${fil}`,
    );
  }

  writeFileSync('out/oversikt.txt', sammanfattning.join('\n') + '\n', 'utf8');

  // Enda stället i projektet där utskrift till terminalen är meningen.
  console.log(sammanfattning.join('\n'));
}

main();
