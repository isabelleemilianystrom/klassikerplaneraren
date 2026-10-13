/**
 * Rendering och händelsehantering. Allt DOM-beroende bor här.
 * Ingen genereringslogik och ingen lagring i den här filen.
 */
import {
  DISCIPLINES,
  type ClassicVariant,
  type Discipline,
  type Level,
  type PlanInput,
  type Program,
  type Week,
} from '../types';
import { engelbrektsloppetMatters, raceDistanceKm, VARIANTS } from '../variants';
import {
  CLASSIC_WINDOW_HELP,
  DISCIPLINE_LABEL,
  DISCLAIMER,
  ENGELBREKTSLOPPET_HELP,
  ENGELBREKTSLOPPET_LABEL,
  LEVEL_LABEL,
  MONTH_LABEL,
  PHASE_LABEL,
  PURPOSE_LABEL,
  RACE_LABEL,
  SNOW_SEASON_HELP,
  SUBSTITUTE_LABEL,
  VARIANT_LABEL,
  VARIANT_SUMMARY,
} from './texts';

const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];
const MONTHS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Ritar formuläret och kopplar submit till `onSubmit`. */
export function renderForm(container: HTMLElement, onSubmit: (input: PlanInput) => void): void {
  const form = document.createElement('form');
  form.className = 'plan-form';
  form.noValidate = false;

  form.append(variantFieldset());

  const races = document.createElement('fieldset');
  const racesLegend = document.createElement('legend');
  racesLegend.textContent = 'Dina lopp och din nivå';
  races.append(racesLegend, help(CLASSIC_WINDOW_HELP));

  for (const discipline of DISCIPLINES) {
    races.append(raceRow(discipline));
  }
  form.append(races);

  form.append(snowSeasonFieldset());
  form.append(hoursRow());

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Skapa program';
  form.append(submit);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSubmit(readForm(form));
  });

  // Formuläret visar alltid distanserna för det som är valt just nu.
  form.addEventListener('change', () => showDistances(form));

  container.append(form);
  showDistances(form);
}

/**
 * Skriver vald distans i varje lopprad och visar bara de fält som betyder något
 * för den valda varianten.
 */
function showDistances(form: HTMLFormElement): void {
  const data = new FormData(form);
  const variant = String(data.get('variant') ?? 'full') as ClassicVariant;
  const engelbrektsloppet = data.get('engelbrektsloppet') !== null;

  for (const discipline of DISCIPLINES) {
    const field = form.querySelector(`[data-distance-for="${discipline}"]`);
    if (field instanceof HTMLElement) {
      field.textContent = formatKm(raceDistanceKm(variant, discipline, engelbrektsloppet));
    }
  }

  for (const field of form.querySelectorAll('[data-only-for-variant]')) {
    if (field instanceof HTMLElement) {
      field.hidden = field.dataset['onlyForVariant'] !== variant;
    }
  }
}

function formatKm(km: number): string {
  return `${km.toLocaleString('sv-SE')} km`;
}

/**
 * Varianten väljs med radioknappar, inte rullgardin, så att distanserna syns
 * utan att användaren behöver öppna något. Valet avgör vad programmet tränar mot.
 */
function variantFieldset(): HTMLElement {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Vilken klassiker gör du?';
  fieldset.append(legend);

  for (const [index, variant] of VARIANTS.entries()) {
    fieldset.append(variantChoice(variant, index === 0));
  }
  return fieldset;
}

function variantChoice(variant: ClassicVariant, checked: boolean): HTMLElement {
  const choice = document.createElement('label');
  choice.className = 'choice';

  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'variant';
  input.value = variant;
  input.checked = checked;

  const name = document.createElement('span');
  name.className = 'choice-name';
  name.textContent = VARIANT_LABEL[variant];

  const summary = document.createElement('span');
  summary.className = 'choice-summary';
  summary.textContent = VARIANT_SUMMARY[variant];

  choice.append(input, name, summary);
  return choice;
}

function snowSeasonFieldset(): HTMLElement {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Din snöperiod';
  fieldset.append(legend, help(SNOW_SEASON_HELP));

  const row = document.createElement('div');
  row.className = 'row';
  // December till mars som standard: täcker Vasaloppet i början av mars.
  row.append(monthField('snowStart', 'Snö från och med', 12));
  row.append(monthField('snowEnd', 'Till och med', 3));
  fieldset.append(row);

  return fieldset;
}

function monthField(name: string, labelText: string, selected: number): HTMLElement {
  const label = document.createElement('label');
  label.textContent = labelText;

  const select = document.createElement('select');
  select.name = name;
  for (const month of MONTHS) {
    const option = document.createElement('option');
    option.value = String(month);
    option.textContent = MONTH_LABEL[month - 1] ?? String(month);
    option.selected = month === selected;
    select.append(option);
  }

  label.append(select);
  return label;
}

function help(text: string): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'help';
  paragraph.textContent = text;
  return paragraph;
}

function raceRow(discipline: Discipline): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';

  const dateLabel = document.createElement('label');
  dateLabel.className = 'race-field';
  dateLabel.append(`${DISCIPLINE_LABEL[discipline]} — `);
  // Distansen beror på varianten och skrivs om när användaren byter variant.
  const distance = document.createElement('span');
  distance.className = 'distance';
  distance.dataset['distanceFor'] = discipline;
  dateLabel.append(distance);

  const date = document.createElement('input');
  date.type = 'date';
  date.name = `race-${discipline}`;
  date.required = true;
  dateLabel.append(date);

  const levelLabel = document.createElement('label');
  levelLabel.textContent = 'Nuvarande nivå';
  const level = document.createElement('select');
  level.name = `level-${discipline}`;
  for (const value of LEVELS) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = LEVEL_LABEL[value];
    level.append(option);
  }
  levelLabel.append(level);

  row.append(dateLabel, levelLabel);
  if (discipline === 'skiing') {
    row.append(engelbrektsloppetField());
  }
  return row;
}

/**
 * Kryssrutan visas bara i den hela klassikern, där Engelbrektsloppets 60 km
 * skiljer sig från Vasaloppets 90. I övriga varianter betyder valet ingenting.
 */
function engelbrektsloppetField(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'race-option';
  wrapper.dataset['onlyForVariant'] = 'full';

  const label = document.createElement('label');
  label.className = 'choice';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'engelbrektsloppet';

  const name = document.createElement('span');
  name.className = 'choice-name';
  name.textContent = ENGELBREKTSLOPPET_LABEL;

  label.append(input, name);
  wrapper.append(label, help(ENGELBREKTSLOPPET_HELP));
  return wrapper;
}

function hoursRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';

  const label = document.createElement('label');
  label.textContent = 'Timmar du kan träna per vecka';
  const hours = document.createElement('input');
  hours.type = 'number';
  hours.name = 'hoursPerWeek';
  hours.min = '1';
  hours.max = '30';
  hours.step = '0.5';
  hours.value = '6';
  hours.required = true;
  label.append(hours);

  row.append(label);
  return row;
}

function readForm(form: HTMLFormElement): PlanInput {
  const data = new FormData(form);
  const races = {} as PlanInput['races'];
  const levels = {} as PlanInput['levels'];

  for (const discipline of DISCIPLINES) {
    races[discipline] = String(data.get(`race-${discipline}`) ?? '');
    levels[discipline] = String(data.get(`level-${discipline}`) ?? 'beginner') as Level;
  }

  const variant = String(data.get('variant') ?? 'full') as ClassicVariant;

  return {
    variant,
    // Kryssrutan är dold i varianter där den inte betyder något. Den får inte
    // smyga med ett gammalt kryss därifrån.
    engelbrektsloppet: engelbrektsloppetMatters(variant) && data.get('engelbrektsloppet') !== null,
    races,
    levels,
    hoursPerWeek: Number(data.get('hoursPerWeek') ?? 0),
    snowSeason: {
      startMonth: Number(data.get('snowStart') ?? 12),
      endMonth: Number(data.get('snowEnd') ?? 3),
    },
  };
}

/** Ritar programmet vecka för vecka. */
export function renderProgram(container: HTMLElement, program: Program): void {
  container.replaceChildren();

  if (program.weeks.length === 0) {
    container.append(message('Programmet innehåller inga veckor än.'));
    return;
  }

  const list = document.createElement('ol');
  list.className = 'weeks';
  for (const [index, week] of program.weeks.entries()) {
    list.append(weekItem(week, index + 1));
  }
  container.append(list);
}

function weekItem(week: Week, number: number): HTMLElement {
  const item = document.createElement('li');
  item.className = 'week';

  const heading = document.createElement('h3');
  heading.textContent = `Vecka ${number} — ${PHASE_LABEL[week.phase]} mot ${RACE_LABEL[week.targetRace]}`;

  const meta = document.createElement('p');
  meta.className = 'week-meta';
  meta.textContent = `Start ${week.startDate} · ${formatHours(week.totalHours)}`;

  const sessions = document.createElement('ul');
  for (const session of week.sessions) {
    const row = document.createElement('li');
    const what = session.substitute
      ? `${DISCIPLINE_LABEL[session.discipline]} (${SUBSTITUTE_LABEL[session.substitute]})`
      : DISCIPLINE_LABEL[session.discipline];
    row.textContent = `${what} · ${formatHours(session.hours)} · ${PURPOSE_LABEL[session.purpose]}`;
    sessions.append(row);
  }

  item.append(heading, meta, sessions);
  return item;
}

/** Ett meddelande till användaren, t.ex. ett fel. */
export function message(text: string): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'message';
  paragraph.textContent = text;
  return paragraph;
}

/** Friskrivningen, som ska synas i UI och inte bara i README. */
export function renderDisclaimer(container: HTMLElement): void {
  const note = document.createElement('p');
  note.className = 'disclaimer';
  note.textContent = DISCLAIMER;
  container.append(note);
}

function formatHours(hours: number): string {
  return `${hours.toLocaleString('sv-SE')} h`;
}
