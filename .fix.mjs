import { readFileSync, writeFileSync } from 'node:fs';
const p = 'tests/fixed-texts.test.ts';
let s = readFileSync(p, 'utf8');
const byt = (från, till) => {
  if (!s.includes(från)) throw new Error(från.slice(0, 80));
  s = s.replace(från, till);
};

// Hämta tabellens rader ur själva tabellen, inte ur hela dokumentet.
byt(
  [
    'const SPEC = readFileSync(\'docs/kravspec-v1.md\', \'utf8\');',
  ].join('\n'),
  [
    "const SPEC = readFileSync('docs/kravspec-v1.md', 'utf8');",
    '',
    '/**',
    ' * Raderna i avsnitt 8:s tabell över fasta texter.',
    ' *',
    ' * Tabellen börjar med sin rubrikrad och slutar vid första tomma raden.',
    ' * Att leta efter rader i hela dokumentet fångar andra tabeller — kravens',
    ' * tabell innehåller också ordet "Startsida".',
    ' */',
    'function tabellrader(): string[] {',
    "  const rader = SPEC.split('\n');",
    "  const start = rader.findIndex((rad) => rad.startsWith('| Text | Var | Innehåll |'));",
    "  if (start === -1) throw new Error('Avsnitt 8 saknar tabellen över fasta texter');",
    '',
    '  const resultat: string[] = [];',
    '  // +2 hoppar över rubrikraden och markdowns avgränsare.',
    '  for (let i = start + 2; i < rader.length; i += 1) {',
    '    const rad = rader[i] as string;',
    "    if (!rad.startsWith('|')) break;",
    '    resultat.push(rad);',
    '  }',
    '',
    '  return resultat;',
    '}',
  ].join('\n'),
);

byt(
  [
    '  const rad = SPEC.split(\'\n\').find((kandidat) => kandidat.startsWith(`| ${namn} |`));',
  ].join('\n'),
  [
    '  const rad = tabellrader().find((kandidat) => kandidat.startsWith(`| ${namn} |`));',
  ].join('\n'),
);

byt(
  [
    '    const rader = SPEC.split(\'\n\')',
    "      .filter((rad) => /^\| [^|]+ \| (Startsida|Planen|Varje pass|Vid förklaringarna)/.test(rad))",
    "      .map((rad) => (rad.split('|')[1] as string).trim());",
  ].join('\n'),
  [
    "    const rader = tabellrader().map((rad) => (rad.split('|')[1] as string).trim());",
  ].join('\n'),
);

writeFileSync(p, s, 'utf8');
console.log('ok');
