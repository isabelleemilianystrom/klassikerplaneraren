import { readFileSync, writeFileSync } from 'node:fs';

const byt = (p, från, till) => {
  const s = readFileSync(p, 'utf8');
  if (!s.includes(från)) throw new Error(p + ': ' + från.slice(0, 80));
  writeFileSync(p, s.replace(från, till), 'utf8');
};

// 1. Datamodellen.
byt(
  'src/engine/types.ts',
  '/** Veckodag enligt ISO: 1 = måndag, 7 = söndag. */',
  [
    '/**',
    ' * Vad användaren vill med ett lopp (R-38).',
    ' *',
    ' * `finish` — ta sig i mål. `time` — sikta på en tid.',
    ' *',
    ' * Skillnaden är stor i träningsupplägg. Den som bara vill komma runt',
    ' * Vansbrosimningen behöver vattenvana och teknik, inte simvolym. Den som vill',
    ' * slå en tid behöver bådadera.',
    ' */',
    "export type RaceGoal = 'finish' | 'time';",
    '',
    '/** Veckodag enligt ISO: 1 = måndag, 7 = söndag. */',
  ].join('\n'),
);

byt(
  'src/engine/types.ts',
  '  schemaVersion: 2;\n  today: IsoDate;\n  startDate: IsoDate;\n  races: { id: RaceId; date: IsoDate }[];',
  [
    '  schemaVersion: 3;',
    '  today: IsoDate;',
    '  startDate: IsoDate;',
    '  /** Varje lopp med sitt datum och vad användaren vill med det (R-38). */',
    '  races: { id: RaceId; date: IsoDate; goal: RaceGoal }[];',
  ].join('\n'),
);

byt('src/engine/types.ts', 'export interface Plan {\n  schemaVersion: 2;', 'export interface Plan {\n  schemaVersion: 3;');

// 2. Konfigurationen: vad målet gör med fördelningen.
const rp = 'config/rules.json';
const ru = JSON.parse(readFileSync(rp, 'utf8'));

ru.raceGoal = {
  _rule: 'R-38',
  note:
    'Den som bara vill ta sig i mål behöver vattenvana och teknik, inte volym. Den som vill ' +
    'slå en tid behöver bådadera. Målet "finish" sänker därför grenens andel av veckan och ' +
    'flyttar tiden till de lopp användaren faktiskt siktar på. Teknikpassen rörs aldrig — det ' +
    'är de som gör loppet görbart, och de är billigast i tid.',
  finishWeightFactor: 0.6,
};

writeFileSync(rp, JSON.stringify(ru, null, 2) + '\n', 'utf8');

// 3. Schemat.
byt(
  'src/engine/config.ts',
  '  /** R-36: vad som händer med en gren vars lopp är avklarat. */',
  [
    '  /** R-38: vad målet med loppet gör med grenens andel. */',
    '  raceGoal: z.object({',
    '    _rule: z.string(),',
    '    note: z.string(),',
    '    /** Grenens vikt multipliceras med detta när målet är att ta sig i mål. */',
    '    finishWeightFactor: share,',
    '  }),',
    '  /** R-36: vad som händer med en gren vars lopp är avklarat. */',
  ].join('\n'),
);

console.log('ok');
