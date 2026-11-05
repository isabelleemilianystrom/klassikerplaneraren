/**
 * Kör kravspecens invarianter mot slumpad men giltig indata (avsnitt 9).
 *
 * **Det här är en utredning, inte ett test.** CLAUDE.md förbjuder att committa
 * kod där testerna inte går igenom, och harnessen går med stor sannolikhet röd
 * första gången — det är hela poängen med den. Som skript får vi veta vad som
 * är fel utan att svitens status ändras. När fynden är åtgärdade flyttas
 * kontrollerna till ett riktigt test.
 *
 * Kör med `npm run invariants`. Antal indata och första seed går att styra:
 *
 *     npm run invariants -- 500
 *     npm run invariants -- 500 9000
 *
 * Varje brott skrivs ut med sitt seed, så det går att köra om exakt samma
 * indata. Med `Math.random` hade det inte gått.
 */
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { generateInputs } from '../tests/generators.ts';
import { INVARIANTS } from '../tests/invariants.ts';
import { PROFILES } from '../tests/profiles.ts';
import type { PlanInput } from '../src/engine/types.ts';

/** Ett brott: vilken invariant, vilket seed, och vad som gick fel. */
interface Brott {
  invariant: string;
  rule: string;
  seed: number | string;
  detalj: string;
}

/** Kör alla invarianter mot en plan och samla brotten. */
function prövaEn(seed: number | string, input: PlanInput): Brott[] {
  const brott: Brott[] = [];

  let planer;
  try {
    planer = buildWeekPlans(input);
  } catch (fel) {
    return [
      {
        invariant: 'motorn kastar inte på giltig indata',
        rule: 'R-01',
        seed,
        detalj: fel instanceof Error ? fel.message : String(fel),
      },
    ];
  }

  for (const invariant of INVARIANTS) {
    for (const detalj of invariant.check(input, planer)) {
      brott.push({ invariant: invariant.name, rule: invariant.rule, seed, detalj });
    }
  }

  return brott;
}

/**
 * Ett heltal ur ett kommandoradsargument, eller standardvärdet.
 *
 * `Number('abc')` ger NaN, och `Array.from({ length: NaN })` ger en tom lista
 * — skriptet körde då utan att pröva någonting och såg ut att lyckas. Ett
 * orimligt stort tal hänger i stället. Hellre ett tydligt fel.
 */
function heltalArgument(värde: string | undefined, standard: number, namn: string): number {
  if (värde === undefined) return standard;

  const tal = Number(värde);
  const rimligt = Number.isInteger(tal) && tal > 0 && tal <= 100_000;

  if (!rimligt) {
    console.error(`${namn} ska vara ett heltal mellan 1 och 100 000, inte "${värde}"`);
    process.exit(1);
  }

  return tal;
}

function main(): void {
  const antal = heltalArgument(process.argv[2], 200, 'antal indata');
  const förstaSeed = heltalArgument(process.argv[3], 1, 'första seed');

  console.log('Invarianter mot slumpad indata');
  console.log('==============================\n');
  console.log(`${INVARIANTS.length} invarianter, ${antal} slumpade indata från seed ${förstaSeed}`);
  console.log('plus de sex referensprofilerna.\n');

  const alla: Brott[] = [];

  // Profilerna först: en invariant som är röd där är felformulerad, inte ett
  // fynd om motorn.
  for (const [namn, profil] of Object.entries(PROFILES)) {
    alla.push(...prövaEn(namn, profil));
  }

  const frånProfiler = alla.length;

  for (const { seed, input } of generateInputs(antal, förstaSeed)) {
    alla.push(...prövaEn(seed, input));
  }

  // Grupperat per invariant: en rad per regel, med ett exempel att köra om.
  const perInvariant = new Map<string, Brott[]>();
  for (const b of alla) {
    const nyckel = `${b.rule} | ${b.invariant}`;
    perInvariant.set(nyckel, [...(perInvariant.get(nyckel) ?? []), b]);
  }

  if (perInvariant.size === 0) {
    console.log(`Alla ${INVARIANTS.length} invarianter håller för samtliga ${antal + 6} planer.`);
    return;
  }

  console.log(`${perInvariant.size} av ${INVARIANTS.length} invarianter brutna.\n`);

  for (const [nyckel, brotten] of [...perInvariant].sort((a, b) => b[1].length - a[1].length)) {
    const seeds = new Set(brotten.map((b) => b.seed));
    console.log(`${nyckel}`);
    console.log(`  ${brotten.length} brott i ${seeds.size} planer`);

    for (const b of brotten.slice(0, 3)) {
      console.log(`  seed ${b.seed}: ${b.detalj}`);
    }
    if (brotten.length > 3) console.log(`  … och ${brotten.length - 3} fler`);
    console.log('');
  }

  console.log(
    `${frånProfiler} brott kom från referensprofilerna — de är felformulerade invarianter,\n` +
      `inte fynd om motorn. Resten kommer från slumpad indata.`,
  );
}

main();
