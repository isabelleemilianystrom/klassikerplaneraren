import { readFileSync, writeFileSync } from 'node:fs';

const p = 'docs/kravspec-v1.md';
let s = readFileSync(p, 'utf8');
const byt = (från, till) => {
  if (!s.includes(från)) throw new Error(från.slice(0, 90));
  s = s.replace(från, till);
};

// R-38 efter R-37.
const rader = s.split('\n');
const r37 = rader.findIndex((r) => r.startsWith('- **R-37**'));
if (r37 === -1) throw new Error('R-37 saknas');
let slut = r37 + 1;
while (slut < rader.length && (rader[slut].startsWith('  ') || rader[slut] === '')) slut += 1;

const r38 = [
  '- **R-38** (tillagd 2026-10-29) **Målet med loppet styr hur mycket grenen får.** Användaren',
  '  anger per lopp om hon vill **ta sig i mål** eller **sikta på en tid**. Förvalt är att ta sig i',
  '  mål — det är vad de flesta vill med sin första klassiker.',
  '',
  '  Den som bara vill komma runt Vansbroån behöver **vattenvana och teknik, inte simvolym**. Den',
  '  som vill slå en tid behöver bådadera. Målet `finish` multiplicerar därför grenens säsongsvikt',
  '  med `raceGoal.finishWeightFactor` — **0,6** — och den frigjorda tiden går till de lopp',
  '  användaren faktiskt siktar på.',
  '',
  '  **Teknikpassen rörs aldrig.** Det är de som gör loppet görbart, och de är billigast i tid.',
  '  **Nybörjaren rörs inte heller:** för den som knappt kan simma är frekvensen själva',
  '  förberedelsen, och nybörjartaket i R-31 håller volymen nere ändå.',
  '',
  '  Är alla lopp satta till samma mål ändras ingenting — andelarna normeras tillbaka. Det är',
  '  **skillnaden mellan loppen** som får genomslag.',
  '',
  '  I profil P5, där Vätternrundan är på tid och Vansbrosimningen bara ska klaras, flyttar regeln',
  '  **tretton timmar** från simningen till cykeln över planens trettiofem veckor.',
];

rader.splice(slut, 0, r38.join('\n'), '');
s = rader.join('\n');

// K-02 får målfrågan.
const k02 = s.split('\n').find((r) => r.startsWith('| K-02 |'));
if (k02 === undefined) throw new Error('K-02 saknas');
byt(
  k02,
  k02.replace(
    'ange datum för varje valt lopp;',
    'ange datum och mål — ta sig i mål eller sikta på en tid — för varje valt lopp *(mål tillagt 2026-10-29)*;',
  ),
);

// Datamodellen.
byt(
  '  races: { id: RaceId; date: string }[];',
  "  races: { id: RaceId; date: string; goal: 'finish' | 'time' }[];   // R-38",
);

byt(
  '  schemaVersion: 2;           // höjd 2026-10-28: preferredDays tillkom',
  '  schemaVersion: 3;           // höjd 2026-10-29: mål per lopp tillkom (R-38)',
);

// Invariant och testfall.
const inv = '- En gren vars lopp är avklarat får högst 10 procent i sin egen säsong och noll utanför den (R-36) *(tillagd 2026-10-28)*';
byt(
  inv,
  inv +
    '\n- En gren man bara vill ta sig i mål i får mindre tid än en man siktar på en tid i, men aldrig noll (R-38) *(tillagd 2026-10-29)*',
);

const tf = '- Lopptaktiken står bara på loppdagen, aldrig på ett träningspass (R-30) (tillagt 2026-10-29)';
byt(
  tf,
  tf +
    '\n- Samma mål på alla lopp ändrar ingenting; det är skillnaden mellan loppen som räknas (R-38) (tillagt 2026-10-29)',
);

writeFileSync(p, s, 'utf8');
console.log('ok');
