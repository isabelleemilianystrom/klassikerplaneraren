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
import { addDays, monthOf, weekdayOf } from '../src/engine/dates.ts';
import { buildWeekPlans, trainingDayCount, type WeekPlan } from '../src/engine/sessions.ts';
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
