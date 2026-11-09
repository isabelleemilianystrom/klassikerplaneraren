/**
 * Kravspecens invarianter som anropbara funktioner (avsnitt 9).
 *
 * Invarianterna står som prosa i kravspecen och är i dag utspridda i 462
 * tester. Den här modulen gör dem anropbara, så att de kan köras mot slumpad
 * indata och inte bara mot de sex referensprofilerna.
 *
 * Filen heter medvetet inte `*.test.ts`: vitest plockar inte upp den. Den är
 * ett bibliotek, inte en svit.
 *
 * Bara invarianter som gäller **motorn** finns här. Lagring, gränssnitt och
 * textbibliotek (K-10, K-13, K-15, avsnitt 8) går inte att pröva mot slumpad
 * indata och ligger kvar i sina egna tester.
 *
 * Varje funktion returnerar en lista brott. Tom lista betyder att invarianten
 * håller. Ett brott är en läsbar rad: vilken vecka, vilket pass, vad som gäller.
 */
import {
  deferredSportsIn,
  newLevelLimit,
  pausedSportsIn,
  weekBudgets,
} from '../src/engine/budget.ts';
import { raceById, rules, sessions as sessionTexts } from '../src/engine/config.ts';
import { addDays, monthOf, startOfWeek, weekdayOf } from '../src/engine/dates.ts';
import { buildWeekPlans, trainingDayCount, type WeekPlan } from '../src/engine/sessions.ts';
import { volumeChecks } from '../src/engine/volume.ts';
import { classicWindowWarnings, midProgrammeStarts, midProgrammeWarnings } from '../src/engine/warnings.ts';
import { buildWeeks } from '../src/engine/weeks.ts';
import type { IsoDate, PlanInput, Session, TrainedSport } from '../src/engine/types.ts';

/** En invariant: ett namn, regelns id, och en kontroll som ger brott. */
export interface Invariant {
  name: string;
  rule: string;
  check: (input: PlanInput, plans: readonly WeekPlan[]) => string[];
}

/* -------------------------------------------------------------------------- */
/* Hjälpare                                                                   */
/* -------------------------------------------------------------------------- */

/** Passen som är riktig träning: inte vila, inte loppet självt. */
function träning(plan: WeekPlan): Session[] {
  return plan.sessions.filter((s) => s.type !== 'rest' && s.type !== 'race');
}

/**
 * Öppningspassen: ett pass dagen före ett lopp i samma gren (R-25).
 *
 * De ligger utanför budgeten och är korta med flit, så flera invarianter
 * undantar dem.
 */
function öppningspass(plan: WeekPlan): Session[] {
  return plan.sessions.filter((s) =>
    plan.sessions.some(
      (k) => k.type === 'race' && k.sport === s.sport && k.date === addDays(s.date, 1),
    ),
  );
}

/** Passen som bär veckans belastning: hårt pass eller långpass (R-43). */
function belastade(plan: WeekPlan): Session[] {
  return träning(plan).filter(
    (s) => s.type === 'long' || (s.zone !== null && s.zone >= 3),
  );
}

function golvFör(sport: Exclude<Session['sport'], null>): number {
  const per: Record<string, number> = rules.session.minMinutesBySport;
  return per[sport] ?? rules.session.minMinutes;
}

function takFör(sport: Exclude<Session['sport'], null>): number {
  const per: Record<string, number> = rules.session.maxMinutesBySport;
  return per[sport] ?? rules.session.maxMinutes;
}

function fokusgren(plan: WeekPlan): TrainedSport | null {
  if (plan.week.focusRaceId === null) return null;
  return raceById(plan.week.focusRaceId).sport as TrainedSport;
}

/** Passen per dag, vila oräknad. */
function perDag(plan: WeekPlan): Map<IsoDate, Session[]> {
  const karta = new Map<IsoDate, Session[]>();

  for (const s of plan.sessions) {
    if (s.type === 'rest') continue;
    const rad = karta.get(s.date) ?? [];
    rad.push(s);
    karta.set(s.date, rad);
  }

  return karta;
}

/* -------------------------------------------------------------------------- */
/* Invarianterna                                                              */
/* -------------------------------------------------------------------------- */

export const INVARIANTS: readonly Invariant[] = [
  {
    name: 'minst en hel vilodag i veckan',
    rule: 'R-11',
    check: (_input, plans) =>
      plans
        .filter(
          (p) =>
            p.sessions.filter((s) => s.type === 'rest').length < rules.trainingDays.minRestDays,
        )
        .map((p) => `v${p.week.index}: ingen vilodag`),
  },

  {
    name: 'den valda vilodagen är fri, utom för lopp och öppningspass',
    rule: 'R-11',
    check: (input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const öppning = öppningspass(p);

        for (const s of p.sessions) {
          if (s.type === 'rest' || s.type === 'race') continue;
          if (öppning.includes(s)) continue;
          if (weekdayOf(s.date) !== input.preferredDays.rest) continue;

          brott.push(`v${p.week.index} ${s.id}: träning på vilodagen ${s.date}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'ingen dag bär mer än ett pass, och styrkan ligger ensam',
    rule: 'R-42',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const [datum, dagens] of perDag(p)) {
          if (dagens.length > 1) {
            brott.push(`v${p.week.index} ${datum}: ${dagens.length} pass`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'antalet pass är aldrig fler än veckans träningsdagar',
    rule: 'R-11, R-42',
    check: (input, plans) => {
      const tak = trainingDayCount(input.hoursPerWeek);

      return plans
        .filter((p) => {
          const dagar = new Set(träning(p).map((s) => s.date));
          return dagar.size > tak;
        })
        .map((p) => `v${p.week.index}: ${new Set(träning(p).map((s) => s.date)).size} dagar > ${tak}`);
    },
  },

  {
    name: 'inget pass är kortare än sin grens golv, utom öppningspasset',
    rule: 'R-40',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const öppning = öppningspass(p);

        for (const s of träning(p)) {
          if (s.sport === null || öppning.includes(s)) continue;
          const golv = golvFör(s.sport);
          if (s.minutes >= golv) continue;

          brott.push(`v${p.week.index} ${s.id}: ${s.sport} ${s.minutes} min < ${golv}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'inget pass är längre än sin grens tak',
    rule: 'R-40, R-12',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (s.sport === null) continue;
          const tak = takFör(s.sport);
          if (s.minutes <= tak) continue;

          brott.push(`v${p.week.index} ${s.id}: ${s.sport} ${s.minutes} min > ${tak}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'långpasset är veckans längsta pass, i alla grenar',
    rule: 'R-42',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const lång = träning(p).find((s) => s.type === 'long');
        if (lång === undefined) continue;

        for (const s of träning(p)) {
          if (s.sport === 'strength' || s.minutes <= lång.minutes) continue;
          brott.push(`v${p.week.index} ${s.id}: ${s.minutes} min > långpassets ${lång.minutes}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'högst två belastade dagar, aldrig två inom två dagar',
    rule: 'R-43',
    check: (_input, plans) => {
      const brott: string[] = [];
      const gap = rules.intensity.minEasyDaysAfterHard;

      for (const p of plans) {
        if (belastade(p).length > 2) {
          brott.push(`v${p.week.index}: ${belastade(p).length} belastade dagar`);
        }
      }

      // Också över veckogränsen.
      const dagar = new Set(plans.flatMap((p) => belastade(p).map((s) => s.date)));

      for (const datum of dagar) {
        for (let steg = 1; steg <= gap; steg += 1) {
          if (!dagar.has(addDays(datum, steg))) continue;
          brott.push(`${datum}: belastad dag igen ${steg} dagar senare`);
        }
      }

      return brott;
    },
  },

  {
    name: 'passen plus den oplacerade tiden är exakt veckans budget',
    rule: 'R-29',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const öppning = öppningspass(p);
        const planerat = p.sessions
          .filter((s) => s.type !== 'rest' && s.type !== 'race' && !öppning.includes(s))
          .reduce((a, s) => a + s.minutes, 0);

        const budget = p.budget.enduranceMinutes + p.budget.strengthMinutes;
        if (planerat + p.budget.unplacedMinutes === budget) continue;

        brott.push(
          `v${p.week.index}: ${planerat} + ${p.budget.unplacedMinutes} oplacerat ≠ ${budget}`,
        );
      }

      return brott;
    },
  },

  {
    name: 'oplacerad tid är alltid mindre än ett pass',
    rule: 'R-29, R-40',
    check: (_input, plans) =>
      plans
        .filter((p) => p.budget.unplacedMinutes >= rules.session.minMinutes)
        .map((p) => `v${p.week.index}: ${p.budget.unplacedMinutes} min oplacerat`),
  },

  {
    name: 'summan per sport plus oplacerat är veckans konditionstid',
    rule: 'R-29, R-31',
    check: (input, plans) => {
      const brott: string[] = [];

      // Läses ur weekBudgets, inte ur planen: `unplacedMinutes` skrivs över
      // på passnivå (R-29) och betyder då "minuter som inte blev ett pass",
      // inte "minuter som inte gick till någon gren". Att ett fält bär båda
      // meningarna är ett eget fynd — se rapporten från etapp 1.
      for (const [i, budget] of weekBudgets(input).entries()) {
        const summa = Object.values(budget.bySport).reduce((a, b) => a + b, 0);
        if (summa + budget.unplacedMinutes === budget.enduranceMinutes) continue;

        brott.push(
          `v${i + 1}: ${summa} + ${budget.unplacedMinutes} ≠ ${budget.enduranceMinutes}`,
        );
      }
      void plans;

      return brott;
    },
  },

  {
    name: 'varje pass i zon 3–4 ligger i veckans fokusgren',
    rule: 'R-42',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const fokus = fokusgren(p);
        if (fokus === null) continue;

        for (const s of träning(p)) {
          if (s.zone === null || s.zone < 3 || s.sport === fokus) continue;
          brott.push(`v${p.week.index} ${s.id}: ${s.sport} i zon ${s.zone}, fokus är ${fokus}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'inget hårt pass över fasens tak på hårda minuter',
    rule: 'R-15',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const fas = rules.intensity.byPhase[p.week.phase];
        const tak = 'maxHardMinutes' in fas ? fas.maxHardMinutes : undefined;
        if (tak === undefined) continue;

        for (const s of träning(p)) {
          if (s.zone === null || s.zone < 3 || s.minutes <= tak) continue;
          brott.push(`v${p.week.index} ${s.id}: ${s.minutes} min i zon ${s.zone} > ${tak}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'ingen zon över fasens tak',
    rule: 'R-15',
    check: (input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const fas = rules.intensity.byPhase[p.week.phase];

        for (const s of träning(p)) {
          if (s.zone === null || s.sport === null) continue;

          const nedsatt = 'maxZoneForNewLevel' in fas ? fas.maxZoneForNewLevel : undefined;
          const nivå = input.levels[s.sport as TrainedSport];
          const tak = nivå === 'new' && nedsatt !== undefined
            ? Math.min(fas.maxZone, nedsatt)
            : fas.maxZone;

          if (s.zone <= tak) continue;
          brott.push(`v${p.week.index} ${s.id}: zon ${s.zone} > ${tak} i ${p.week.phase}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'inget simpass beskriver ansträngningen med att prata',
    rule: 'R-15',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (s.sport !== 'swim') continue;
          if (!/prata/i.test(s.instruction ?? '')) continue;

          brott.push(`v${p.week.index} ${s.id}: simpass som talar om att prata`);
        }
      }

      return brott;
    },
  },

  {
    name: 'nivå Ny håller sitt veckotak i minuter och antal pass',
    rule: 'R-31',
    check: (input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const sport of ['ski', 'bike', 'swim', 'run'] as const) {
          const gräns = newLevelLimit(sport, input);
          if (gräns === null) continue;

          // Loppet och öppningspasset ligger utanför budgeten (R-04, R-25) och
          // räknas av från taket i stället för in i det: Vansbrosimningen tar
          // sextio minuter och öppningspasset tjugofem, alltså åttiofem av ett
          // tak på åttio. Träningen är det taket gäller.
          const öppning = öppningspass(p);
          const egna = p.sessions.filter(
            (s) =>
              s.sport === sport &&
              s.type !== 'rest' &&
              s.type !== 'race' &&
              !öppning.includes(s),
          );
          const minuter = egna.reduce((a, s) => a + s.minutes, 0);

          const loppet = p.sessions
            .filter((s) => s.sport === sport && (s.type === 'race' || öppning.includes(s)))
            .reduce((a, s) => a + s.minutes, 0);

          const kvar = Math.max(0, gräns.maxMinutesPerWeek - loppet);
          const flest = p.week.raceIds.length > 0 ? gräns.maxSessionsPerWeek : gräns.maxSessionsPerWeek;

          if (minuter > kvar) {
            brott.push(`v${p.week.index}: ${sport} ${minuter} min > ${kvar} (tak ${gräns.maxMinutesPerWeek} minus loppet ${loppet})`);
          }
          if (egna.length > flest) {
            brott.push(`v${p.week.index}: ${sport} ${egna.length} pass > ${flest}`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'inga pass före startdatum eller efter sista loppet',
    rule: 'R-01, R-04',
    check: (input, plans) => {
      const sista = [...input.races].sort((a, b) => b.date.localeCompare(a.date))[0];
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of p.sessions) {
          if (s.type === 'rest') continue;
          if (s.date < input.startDate) brott.push(`${s.id}: ${s.date} före start`);
          if (sista !== undefined && s.date > sista.date) {
            brott.push(`${s.id}: ${s.date} efter sista loppet`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'loppdagen innehåller bara loppet',
    rule: 'R-04',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const loppdagar = new Set(p.sessions.filter((s) => s.type === 'race').map((s) => s.date));

        for (const s of p.sessions) {
          if (s.type === 'race' || s.type === 'rest') continue;
          if (!loppdagar.has(s.date)) continue;

          brott.push(`v${p.week.index} ${s.id}: träning på loppdagen ${s.date}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'varje lopp-pass har ett raceId som finns',
    rule: 'R-04',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of p.sessions) {
          if (s.type !== 'race') continue;

          if (s.raceId === undefined) {
            brott.push(`${s.id}: loppet saknar raceId`);
            continue;
          }

          try {
            raceById(s.raceId);
          } catch {
            brott.push(`${s.id}: okänt raceId ${s.raceId}`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'varje pass har titel, instruktion och längd inom R-12',
    rule: 'R-12, R-30',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if ((s.title ?? '') === '') brott.push(`${s.id}: saknar titel`);
          if ((s.instruction ?? '') === '') brott.push(`${s.id}: saknar instruktion`);
          if (s.minutes > rules.session.maxMinutes) {
            brott.push(`${s.id}: ${s.minutes} min > ${rules.session.maxMinutes}`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'pass i simning och skidor är teknikpass under återhämtningen',
    rule: 'R-33',
    check: (_input, plans) => {
      const teknikgrenar: readonly string[] = rules.recovery.techniqueSports;
      const brott: string[] = [];

      for (const p of plans) {
        if (p.week.phase !== 'recovery') continue;

        for (const s of träning(p)) {
          if (s.sport === null || !teknikgrenar.includes(s.sport)) continue;
          if (s.type === 'technique') continue;

          brott.push(`v${p.week.index} ${s.id}: ${s.sport} som ${s.type} i återhämtning`);
        }
      }

      return brott;
    },
  },

  {
    name: 'långpasset ligger på den valda dagen när den är fri',
    rule: 'R-13',
    check: (input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        const lång = träning(p).find((s) => s.type === 'long');
        if (lång === undefined) continue;
        if (weekdayOf(lång.date) === input.preferredDays.longSession) continue;

        // Dagen får vara tagen av ett lopp eller ett öppningspass (R-04).
        const önskad = p.sessions.find(
          (s) => weekdayOf(s.date) === input.preferredDays.longSession,
        );
        const upptagen =
          önskad !== undefined &&
          (önskad.type === 'race' || öppningspass(p).includes(önskad));

        if (upptagen) continue;

        // Och den kan ha passerat: planen börjar på måndagen i startdatumets
        // vecka (R-01), så den första veckan kan sakna veckodagar helt.
        const finns = p.sessions.some(
          (s) => weekdayOf(s.date) === input.preferredDays.longSession,
        );
        if (!finns) continue;
        brott.push(`v${p.week.index}: långpasset på ${lång.date}, valde dag ${input.preferredDays.longSession}`);
      }

      return brott;
    },
  },

  {
    name: 'ingen ny löpare får löppass två dagar i rad',
    rule: 'R-14',
    check: (input, plans) => {
      if (input.levels.run !== 'new') return [];

      const löpdagar = new Set(
        plans.flatMap((p) =>
          p.sessions.filter((s) => s.sport === 'run' && s.type !== 'race').map((s) => s.date),
        ),
      );

      return [...löpdagar]
        .filter((datum) => löpdagar.has(addDays(datum, 1)))
        .map((datum) => `${datum}: löppass också dagen efter`);
    },
  },

  {
    name: 'ett skidpass står som skidpass bara när det finns snö',
    rule: 'R-17',
    check: (input, plans) => {
      const snögrenar: readonly string[] = rules.substitutions.snowSports;
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (s.sport === null || !snögrenar.includes(s.sport)) continue;
          if (s.substitutedAs !== undefined) continue;

          const vinter = rules.season.winterMonths.includes(monthOf(s.date));
          const spår = rules.substitutions.snowNeeds.every(
            (flagga) => (input.equipment as Record<string, boolean>)[flagga] === true,
          );

          if (vinter && spår) continue;
          brott.push(`v${p.week.index} ${s.id}: ${s.sport} utan snö (${s.date}, spår: ${spår})`);
        }
      }

      return brott;
    },
  },

  {
    name: 'ett pass som bytt gren har inga alternativ',
    rule: 'R-20, R-37',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (s.substitutedAs === undefined) continue;
          if (!s.substitutedAs.startsWith('ski.')) continue;
          if (s.alternatives.length === 0) continue;

          brott.push(`v${p.week.index} ${s.id}: ersatt pass med ${s.alternatives.length} alternativ`);
        }
      }

      return brott;
    },
  },

  {
    name: 'alternativ erbjuds aldrig för lopp, vila, styrka eller teknik',
    rule: 'R-37',
    check: (_input, plans) => {
      const tillåtna: readonly string[] = rules.sessionAlternatives.forTypes;
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of p.sessions) {
          if (s.alternatives === undefined || s.alternatives.length === 0) continue;
          if (tillåtna.includes(s.type)) continue;

          brott.push(`v${p.week.index} ${s.id}: alternativ på ${s.type}`);
        }
      }

      return brott;
    },
  },

  {
    name: 'varje långpass i löpning erbjuder cykel som alternativ',
    rule: 'R-37, R-47',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (s.sport !== 'run' || s.type !== 'long') continue;
          if (s.substitutedAs !== undefined) continue;
          if (s.alternatives.some((a) => a.sport === 'bike')) continue;

          brott.push(`v${p.week.index} ${s.id}: långpass i löpning utan cykel som alternativ`);
        }
      }

      return brott;
    },
  },

  {
    name: 'säkerhetstexten för öppet vatten står på simpass juni–augusti',
    rule: 'R-19',
    check: (_input, plans) => {
      const månader: readonly number[] = rules.season.openWaterMonths;
      const text = sessionTexts.safetyNotes.openWater.text;
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of p.sessions) {
          if (s.sport !== 'swim' || s.type === 'rest') continue;
          if (s.substitutedAs !== undefined) continue;

          const iSäsong = månader.includes(monthOf(s.date));

          if (iSäsong && s.safetyNote !== text) {
            brott.push(`v${p.week.index} ${s.id}: saknar säkerhetstext i öppet vatten`);
          }
          if (!iSäsong && s.safetyNote !== undefined) {
            brott.push(`v${p.week.index} ${s.id}: säkerhetstext utanför säsongen`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'långpasset krymper aldrig inom en fas',
    rule: 'R-46',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (let i = 1; i < plans.length; i += 1) {
        const a = plans[i - 1] as WeekPlan;
        const b = plans[i] as WeekPlan;

        if (a.week.phaseId !== b.week.phaseId) continue;
        if (a.week.isDeload || b.week.isDeload) continue;

        // En avkortad första vecka (R-01) har färre platser, och då blir dess
        // långpass en större andel av en mindre vecka. Jämförelsen är därför
        // inte meningsfull över den gränsen.
        if (a.sessions.length < 7) continue;

        const la = träning(a).find((s) => s.type === 'long');
        const lb = träning(b).find((s) => s.type === 'long');
        if (la === undefined || lb === undefined || la.sport !== lb.sport) continue;

        if (lb.minutes >= la.minutes) continue;
        brott.push(`v${a.week.index}→v${b.week.index}: ${la.minutes} → ${lb.minutes} min`);
      }

      return brott;
    },
  },

  {
    name: 'löpningens långpass växer högst femton procent i veckan',
    rule: 'R-46',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (let i = 1; i < plans.length; i += 1) {
        const a = plans[i - 1] as WeekPlan;
        const b = plans[i] as WeekPlan;

        if (a.week.phaseId !== b.week.phaseId) continue;
        if (a.week.isDeload || b.week.isDeload) continue;

        const la = träning(a).find((s) => s.type === 'long' && s.sport === 'run');
        const lb = träning(b).find((s) => s.type === 'long' && s.sport === 'run');
        if (la === undefined || lb === undefined) continue;

        const ökning = (lb.minutes - la.minutes) / la.minutes;
        if (ökning <= 0.15) continue;

        brott.push(
          `v${a.week.index}→v${b.week.index}: ${la.minutes} → ${lb.minutes} min (+${Math.round(ökning * 100)} %)`,
        );
      }

      return brott;
    },
  },

  {
    name: 'fokusveckorna ger loppets gren veckan, och loppveckan är aldrig en av dem',
    rule: 'R-45',
    check: (input, plans) => {
      const veckor = buildWeeks(input);
      const brott: string[] = [];

      for (const p of plans) {
        const vecka = veckor[p.week.index - 1];
        if (vecka === undefined) continue;

        const pausade = pausedSportsIn(input, vecka);
        if (pausade.size === 0) continue;

        if (p.week.raceIds.length > 0) {
          brott.push(`v${p.week.index}: loppveckan är flaggad som fokusvecka`);
          continue;
        }

        const fokus = fokusgren(p);
        if (fokus === null || pausade.has(fokus)) {
          brott.push(`v${p.week.index}: fokusgrenen är pausad`);
          continue;
        }

        // Löptaket i R-14 får skära bort minuter och lägga dem i en pausad
        // gren, så full hundra procent går inte att kräva.
        const andel = (p.budget.bySport[fokus] ?? 0) / Math.max(1, p.budget.enduranceMinutes);
        if (andel > 0.85 || p.budget.enduranceMinutes === 0) continue;

        brott.push(`v${p.week.index}: fokusgrenen ${fokus} har bara ${Math.round(andel * 100)} %`);
      }

      return brott;
    },
  },

  {
    name: 'en gren som väntar får noll minuter',
    rule: 'R-39',
    check: (input, plans) => {
      const veckor = buildWeeks(input);
      const brott: string[] = [];

      for (const p of plans) {
        const vecka = veckor[p.week.index - 1];
        if (vecka === undefined) continue;

        for (const sport of deferredSportsIn(input, vecka)) {
          const minuter = p.budget.bySport[sport] ?? 0;
          if (minuter === 0) continue;

          brott.push(`v${p.week.index}: ${sport} väntar men har ${minuter} min`);
        }
      }

      return brott;
    },
  },

  {
    name: 'loppveckans budget är minskad med loppets tid',
    rule: 'R-25',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        if (p.week.raceIds.length === 0) continue;

        const väntat = p.week.raceIds.reduce(
          (a, id) => a + Math.round(raceById(id).estimatedHours * 60),
          0,
        );

        if (p.budget.raceMinutes === väntat) continue;
        brott.push(`v${p.week.index}: raceMinutes ${p.budget.raceMinutes} ≠ ${väntat}`);
      }

      return brott;
    },
  },


  /* ------------------------------------------------------------------------ */
  /* Tillagda 2026-11-05: kärninvarianter som fattades i första omgången.     */
  /* Harnessen körde 34 av kravspecens lista, och de som saknades var inte    */
  /* de minsta — veckans tid mot fasens tak och att andelarna summerar till   */
  /* hundra procent hör till det mest grundläggande motorn gör.               */
  /* ------------------------------------------------------------------------ */

  {
    name: 'veckans tid överskrider aldrig fasens tak',
    rule: 'R-05, R-06, R-07',
    check: (input, plans) => {
      const T = input.hoursPerWeek * 60;
      const brott: string[] = [];

      for (const p of plans) {
        const { phaseShare, taperShare } = rules.weekTime;

        // Fasens andel av toppveckan. Nedtrappningen har egna tal, och
        // loppveckan styrs av R-25 i stället.
        const andel =
          p.week.phase === 'taper'
            ? Math.max(taperShare.firstWeek, taperShare.secondWeek, taperShare.singleWeek)
            : phaseShare[p.week.phase as 'base'];

        if (andel === undefined) continue;

        // Avlastningsveckan sänker ytterligare, så taket är aldrig högre.
        const tak = Math.ceil(T * andel);
        const budget = p.budget.enduranceMinutes + p.budget.strengthMinutes;

        if (budget <= tak) continue;
        brott.push(`v${p.week.index} ${p.week.phase}: ${budget} min > taket ${tak}`);
      }

      return brott;
    },
  },

  {
    name: 'andelarna mellan grenarna summerar till veckans konditionstid',
    rule: 'R-08',
    check: (input, plans) => {
      void plans;
      const brott: string[] = [];

      for (const [i, budget] of weekBudgets(input).entries()) {
        const summa = Object.values(budget.bySport).reduce((a, b) => a + b, 0);
        if (summa + budget.unplacedMinutes === budget.enduranceMinutes) continue;

        brott.push(
          `v${i + 1}: ${summa} + ${budget.unplacedMinutes} ≠ ${budget.enduranceMinutes}`,
        );
      }

      return brott;
    },
  },

  {
    name: 'återhämtningen efter ett lopp finns kvar',
    rule: 'R-03',
    check: (input, plans) => {
      const brott: string[] = [];

      for (const [i, p] of plans.entries()) {
        if (p.week.raceIds.length === 0) continue;

        const config = p.week.raceIds.map((id) => raceById(id));
        const kräver = Math.max(...config.map((race) => race.recoveryWeeks));
        if (kräver === 0) continue;

        // Veckan efter loppet ska vara återhämtning — utom när nästa lopp
        // ligger så nära att dess egen uppbyggnad tar över (R-03).
        const efter = plans[i + 1];
        if (efter === undefined) continue;
        if (efter.week.raceIds.length > 0) continue;
        if (efter.week.phase === 'recovery' || efter.week.phase === 'taper') continue;

        brott.push(
          `v${p.week.index} har lopp men v${efter.week.index} är ${efter.week.phase}`,
        );
      }

      void input;
      return brott;
    },
  },

  {
    name: 'skidor får mer tid än cykel i en basvecka på vintern',
    rule: 'R-32',
    check: (input, plans) => {
      const vinter = rules.season.winterMonths;
      const brott: string[] = [];

      for (const p of plans) {
        if (p.week.phase !== 'base' || p.budget.enduranceMinutes === 0) continue;
        if (!vinter.includes(monthOf(p.week.startDate))) continue;

        // Är skidloppet avklarat flyttar R-36 tiden till nästa lopps gren med
        // flit, och då gäller inte säsongsvikten. Vasaloppet går i mars, och
        // mars ligger i vinterlistan — utan det här undantaget trippar
        // invarianten på varje vecka efter loppet.
        const skidloppKvar = input.races.some(
          (race) => raceById(race.id).sport === 'ski' && race.date >= p.week.startDate,
        );
        if (!skidloppKvar) continue;

        // R-09 flyttar tio procentenheter till den gren man är ny i, tagna
        // från de vana. Är man ny på cykel och van på skidor går cykeln om
        // med flit — säsongsvikten är inte den enda regeln som gäller.
        const nyCykel = input.levels.bike === 'new';
        const nyaSkidor = input.levels.ski === 'new';
        if (nyCykel && !nyaSkidor) continue;

        const skidor = p.budget.bySport.ski ?? 0;
        const cykel = p.budget.bySport.bike ?? 0;

        // Bara när båda grenarna finns i planen — annars styr andra regler.
        if (skidor === 0 || cykel === 0) continue;
        if (skidor >= cykel) continue;

        brott.push(`v${p.week.index}: skidor ${skidor} < cykel ${cykel} i ${p.week.startDate}`);
      }

      return brott;
    },
  },

  {
    name: 'en gren man är ny i får ett teknikpass i veckan',
    rule: 'R-21',
    check: (input, plans) => {
      const grenar = rules.technique.sportsForNewLevel;
      const veckor = buildWeeks(input);
      const brott: string[] = [];

      for (const p of plans) {
        if (p.week.phase !== 'base' && p.week.phase !== 'specific') continue;
        if (p.week.raceIds.length > 0) continue;

        const vecka = veckor[p.week.index - 1];
        const pausade = vecka === undefined ? new Set() : pausedSportsIn(input, vecka);

        for (const sport of grenar) {
          if (input.levels[sport as TrainedSport] !== 'new') continue;

          // Har grenen ingen tid i veckan finns inget pass att göra teknik av,
          // och är den pausad (R-45) ska den inte tränas alls.
          if ((p.budget.bySport[sport as TrainedSport] ?? 0) === 0) continue;
          if (pausade.has(sport as TrainedSport)) continue;

          const egna = träning(p).filter((s) => s.sport === sport);
          if (egna.length === 0) continue;
          if (egna.some((s) => s.type === 'technique')) continue;

          // Har grenen bara ett pass och det är långpasset finns ingen plats
          // till teknik. Det är fynd F-7, inte en felformulering: R-21 säger
          // ett teknikpass i veckan, och i avlastningsveckorna uteblir det.
          const bara = egna.length === 1 && egna[0]?.type === 'long';
          if (bara) continue;

          brott.push(`v${p.week.index}: ${sport} utan teknikpass`);
        }
      }

      return brott;
    },
  },

  {
    name: 'en avklarad gren tränas bara i sin egen säsong',
    rule: 'R-36',
    check: (input, plans) => {
      const brott: string[] = [];
      const säsonger = rules.seasonWeights.seasons;

      for (const p of plans) {
        const månad = monthOf(p.week.startDate);

        for (const race of input.races) {
          if (race.date >= p.week.startDate) continue;

          const sport = raceById(race.id).sport as TrainedSport;
          const minuter = p.budget.bySport[sport] ?? 0;
          if (minuter === 0) continue;

          // Grenens egen säsong är den där den har högsta vikten.
          const bäst = säsonger.reduce((a, b) =>
            (b.weights[sport as 'ski'] ?? 0) > (a.weights[sport as 'ski'] ?? 0) ? b : a,
          );
          if (bäst.months.includes(månad)) continue;

          // Och andelen ska vara liten: keepShareInOwnSeason är taket.
          const andel = minuter / Math.max(1, p.budget.enduranceMinutes);
          if (andel <= rules.afterRace.keepShareInOwnSeason) continue;

          brott.push(
            `v${p.week.index}: ${sport} har ${Math.round(andel * 100)} % efter sitt lopp, utanför säsongen`,
          );
        }
      }

      return brott;
    },
  },

  {
    name: 'en gren man bara vill ta sig i mål i får tid, men mindre',
    rule: 'R-38',
    check: (input, plans) => {
      // Bara meningsfullt när planen har både ett tidsmål och ett målmål.
      const mål = new Set(input.races.map((race) => race.goal));
      if (mål.size < 2) return [];

      const brott: string[] = [];

      for (const race of input.races) {
        if (race.goal !== 'finish') continue;

        const sport = raceById(race.id).sport as TrainedSport;
        const tid = plans
          .filter((p) => p.week.startDate < race.date)
          .reduce((summa, p) => summa + (p.budget.bySport[sport] ?? 0), 0);

        if (tid > 0) continue;
        brott.push(`${race.id}: noll minuter i ${sport} före loppet`);
      }

      return brott;
    },
  },

  {
    name: 'alla lopp i en vecka hör till veckan',
    rule: 'R-27',
    check: (input, plans) => {
      const brott: string[] = [];

      for (const race of input.races) {
        const vecka = plans.find(
          (p) => race.date >= p.week.startDate && race.date <= addDays(p.week.startDate, 6),
        );
        if (vecka === undefined) continue;

        if (vecka.week.raceIds.includes(race.id)) continue;
        brott.push(`${race.id} ${race.date} saknas i v${vecka.week.index}`);
      }

      return brott;
    },
  },

  {
    name: 'stakmaskinspasset delas när det är längre än sitt tak',
    rule: 'R-44',
    check: (_input, plans) => {
      const stak = rules.substitutions.bySport.ski?.find((rad) => rad.key === 'ski.skiErg');
      const tak = stak?.maxMinutes;
      if (tak === undefined) return [];

      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (s.substitutedAs !== 'ski.skiErg' || s.minutes <= tak) continue;
          if (s.instruction.includes(`högst ${tak} minuter`)) continue;

          brott.push(`v${p.week.index} ${s.id}: ${s.minutes} min utan delningsnotering`);
        }
      }

      return brott;
    },
  },

  {
    name: 'uppmuntran står bara på långpass före loppet i grenen som missar',
    rule: 'R-48',
    check: (input, plans) => {
      const bit = rules.warnings.volumeMilestone.sessionEncouragement.trim().slice(0, 30);
      const missade = volumeChecks(input, plans).filter((check) => !check.reached);
      const grenar = new Set(missade.map((check) => check.sport));
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of träning(p)) {
          if (!s.instruction.includes(bit)) continue;

          if (s.type !== 'long') brott.push(`v${p.week.index} ${s.id}: uppmuntran på ${s.type}`);
          if (s.sport === null || !grenar.has(s.sport as TrainedSport)) {
            brott.push(`v${p.week.index} ${s.id}: uppmuntran i ${s.sport} som når riktmärket`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'loppen mer än tolv månader isär ger varningen, och planen byggs ändå',
    rule: 'R-26',
    check: (input, plans) => {
      if (input.races.length < 2) return [];

      const datum = input.races.map((race) => race.date).sort();
      const första = datum[0] as string;
      const sista = datum.at(-1) as string;

      // Tolv månader räknat grovt: 366 dagar rymmer skottåret.
      const dagar = (Date.parse(sista) - Date.parse(första)) / 86_400_000;
      const utanför = dagar > 366;

      const varnar = classicWindowWarnings(input).length > 0;
      const brott: string[] = [];

      if (utanför && !varnar) brott.push(`${Math.round(dagar)} dagar isär utan varning`);
      if (plans.length === 0) brott.push('ingen plan byggdes');

      return brott;
    },
  },

  {
    name: 'start närmare än tio veckor ger varningen om att hoppa in mitt i',
    rule: 'R-35',
    check: (input, plans) => {
      const gräns = rules.warnings.midProgramme.weeksThreshold;
      const första = [...input.races].sort((a, b) => a.date.localeCompare(b.date))[0];
      if (första === undefined) return [];

      const veckor = Math.floor(
        (Date.parse(startOfWeek(första.date)) - Date.parse(startOfWeek(input.startDate))) /
          (7 * 86_400_000),
      );

      const varnar = midProgrammeWarnings(midProgrammeStarts(input, plans)).length > 0;
      if (veckor >= gräns && !varnar) return [];
      if (veckor < gräns && varnar) return [];
      if (veckor >= gräns && varnar) return [`${veckor} veckor till loppet men varnar ändå`];

      return [`${veckor} veckor till loppet utan varning`];
    },
  },

  {
    name: 'styrkepasset är gymstyrka och bär ingen gren',
    rule: 'R-42',
    check: (_input, plans) => {
      const brott: string[] = [];

      for (const p of plans) {
        for (const s of p.sessions) {
          if (s.type !== 'strength') continue;

          // Det var precis så v0 gick fel: styrkepasset ärvde veckans gren och
          // skrev ut "Längdskidor (stakmaskin) · Styrka".
          if (s.sport !== 'strength') {
            brott.push(`v${p.week.index} ${s.id}: styrkepass med grenen ${s.sport}`);
          }
          if (s.substitutedAs !== undefined) {
            brott.push(`v${p.week.index} ${s.id}: styrkepass med ersättningen ${s.substitutedAs}`);
          }
          if (s.alternatives.length > 0) {
            brott.push(`v${p.week.index} ${s.id}: styrkepass med ${s.alternatives.length} alternativ`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'generalrepet står på ett pass per lopp, före nedtrappningen',
    rule: 'R-49',
    check: (input, plans) => {
      const bit = 'Generalrep inför';
      const brott: string[] = [];

      for (const race of input.races) {
        const sport = raceById(race.id).sport as TrainedSport;
        const namn = raceById(race.id).name;

        const träffar: { vecka: number; session: Session }[] = [];
        for (const p of plans) {
          for (const session of p.sessions) {
            if (!session.instruction.includes(`${bit} ${namn}`)) continue;
            träffar.push({ vecka: p.week.index, session });
          }
        }

        // Noll är giltigt: har grenen bara ersatta pass finns inget att
        // generalrepa på, och P4 utan snö är just det fallet.
        if (träffar.length === 0) continue;

        if (träffar.length > 1) {
          brott.push(`${race.id}: ${träffar.length} generalrep, ska vara ett`);
        }

        for (const { vecka, session } of träffar) {
          if (session.sport !== sport) {
            brott.push(`${race.id}: generalrepet ligger i ${session.sport}`);
          }
          if (session.substitutedAs !== undefined) {
            brott.push(`${race.id}: generalrepet ligger på ett ersatt pass`);
          }
          if (session.date >= race.date) {
            brott.push(`${race.id}: generalrepet ${session.date} ligger inte före loppet`);
          }

          const nedtrappning = plans.find(
            (p) => p.week.phase === 'taper' && p.week.focusRaceId === race.id,
          );
          if (nedtrappning !== undefined && vecka >= nedtrappning.week.index) {
            brott.push(`${race.id}: generalrepet i v${vecka} ligger i nedtrappningen`);
          }
        }
      }

      return brott;
    },
  },

  {
    name: 'samma indata ger samma plan',
    rule: 'determinism',
    check: (input, plans) => {
      const igen = buildWeekPlans(input);
      const a = JSON.stringify(plans);
      const b = JSON.stringify(igen);

      return a === b ? [] : ['två körningar gav olika planer'];
    },
  },
];
