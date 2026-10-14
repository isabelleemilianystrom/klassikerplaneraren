/**
 * Rendering och händelsehantering. Allt DOM-beroende bor här.
 * Ingen genereringslogik och ingen lagring i den här filen.
 */
import {
  DISCIPLINES,
  type ClassicVariant,
  type Discipline,
  type IsoDate,
  type Level,
  type PlanInput,
  type Program,
  type Week,
} from '../types';
import { engelbrektsloppetMatters, raceDistanceKm, VARIANTS } from '../variants';
import { SCHEDULE_CHECKED, upcomingSuggestions } from '../race-schedule';
import {
  CLASSIC_WINDOW_HELP,
  DISCIPLINE_LABEL,
  DISCLAIMER,
  ENGELBREKTSLOPPET_HELP,
  ENGELBREKTSLOPPET_LABEL,
  EQUIPMENT_HELP,
  EQUIPMENT_LABEL,
  LEVEL_LABEL,
  MONTH_LABEL,
  PAST_DATE_HELP,
  PHASE_LABEL,
  PURPOSE_LABEL,
  RACE_LABEL,
  SNOW_SEASON_HELP,
  SUBSTITUTE_LABEL,
  SUGGEST_DATES_LABEL,
  SUGGEST_DATES_NONE,
  suggestionNote,
  suggestionResult,
  VARIANT_LABEL,
  VARIANT_SUMMARY,
  WARNING_TEXT,
} from './texts';

const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];
const MONTHS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Ritar formuläret och kopplar submit till `onSubmit`.
 *
 * `today` skickas in och hämtas inte här, så att rendering och logik utgår från
 * samma datum — och så att vyn går att rita upp för vilket datum som helst.
 */
export function renderForm(
  container: HTMLElement,
  today: IsoDate,
  onSubmit: (input: PlanInput) => void,
): void {
  const form = document.createElement('form');
  form.className = 'plan-form';
  form.noValidate = false;

  form.append(variantFieldset());

  const races = document.createElement('fieldset');
  const racesLegend = document.createElement('legend');
  racesLegend.textContent = 'Dina lopp och din nivå';
  races.append(racesLegend, help(CLASSIC_WINDOW_HELP));

  for (const discipline of DISCIPLINES) {
    races.append(raceRow(discipline, today));
  }
  races.append(suggestionRow(form, today));
  form.append(races);

  form.append(snowSeasonFieldset());
  form.append(equipmentFieldset());
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

/**
 * Utrustningen avgör vad ett skidpass blir utanför snöperioden, och den som
 * saknar både stakmaskin och rullskidor får veta att programmet blir sämre.
 * Frågorna är få med flit — bara där programmet annars måste gissa.
 */
function equipmentFieldset(): HTMLElement {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Vad har du tillgång till?';
  fieldset.append(legend, help(EQUIPMENT_HELP));

  for (const [name, label] of Object.entries(EQUIPMENT_LABEL)) {
    fieldset.append(checkbox(`equipment-${name}`, label));
  }
  return fieldset;
}

function checkbox(name: string, labelText: string): HTMLElement {
  const label = document.createElement('label');
  label.className = 'choice';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = name;

  const text = document.createElement('span');
  text.className = 'choice-name';
  text.textContent = labelText;

  label.append(input, text);
  return label;
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

/**
 * Knappen som fyller i kommande loppdatum.
 *
 * Datumen är inlagda i koden, inte hämtade live — webbläsaren kommer inte åt
 * arrangörernas sidor. Därför skriver vi ut när de senast kontrollerades och
 * ber användaren stämma av mot arrangören.
 */
function suggestionRow(form: HTMLFormElement, today: IsoDate): HTMLElement {
  const row = document.createElement('div');
  row.className = 'suggestion';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = SUGGEST_DATES_LABEL;

  const note = help(suggestionNote(SCHEDULE_CHECKED));
  row.append(button, note);

  button.addEventListener('click', () => {
    const variant = selectedVariant(form);
    const upcoming = upcomingSuggestions(variant, today);
    const filled = fillDates(form, upcoming);
    note.textContent =
      filled === 0 ? SUGGEST_DATES_NONE : suggestionResult(filled, missingCount(upcoming));
  });

  return row;
}

/** Fyller i datumfälten och returnerar hur många som sattes. */
function fillDates(
  form: HTMLFormElement,
  dates: Partial<Record<Discipline, IsoDate>>,
): number {
  let filled = 0;
  for (const discipline of DISCIPLINES) {
    const date = dates[discipline];
    const field = form.querySelector(`input[name="race-${discipline}"]`);
    if (date !== undefined && field instanceof HTMLInputElement) {
      field.value = date;
      filled += 1;
    }
  }
  return filled;
}

function missingCount(dates: Partial<Record<Discipline, IsoDate>>): number {
  return DISCIPLINES.length - Object.keys(dates).length;
}

function selectedVariant(form: HTMLFormElement): ClassicVariant {
  return String(new FormData(form).get('variant') ?? 'full') as ClassicVariant;
}

function raceRow(discipline: Discipline, today: IsoDate): HTMLElement {
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
  // Ett lopp som redan varit går inte att träna mot. Webbläsaren spärrar både
  // kalendern och submit; generatorn kontrollerar samma sak som skyddsnät.
  date.min = today;
  date.title = PAST_DATE_HELP;
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
    equipment: {
      skiErgometer: data.get('equipment-skiErgometer') !== null,
      rollerSkis: data.get('equipment-rollerSkis') !== null,
      indoorTrainer: data.get('equipment-indoorTrainer') !== null,
    },
  };
}

/** Ritar programmet vecka för vecka. */
export function renderProgram(container: HTMLElement, program: Program): void {
  container.replaceChildren();

  for (const warning of program.warnings) {
    const note = document.createElement('p');
    note.className = 'warning';
    note.textContent = WARNING_TEXT[warning];
    container.append(note);
  }

  if (program.weeks.length === 0) {
    container.append(message('Programmet innehåller inga veckor än.'));
    return;
  }

  container.append(summary(program));

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

  // Loppet är veckans huvudhändelse och ska synas tydligare än passen.
  const raceNote = document.createElement('p');
  if (week.raceDate !== undefined) {
    raceNote.className = 'race-day';
    raceNote.textContent = `${raceLabel(week.targetRace)} ${week.raceDate}`;
  }

  const sessions = document.createElement('ul');
  for (const session of week.sessions) {
    const row = document.createElement('li');
    const what = session.substitute
      ? `${DISCIPLINE_LABEL[session.discipline]} (${SUBSTITUTE_LABEL[session.substitute]})`
      : DISCIPLINE_LABEL[session.discipline];
    row.textContent = `${what} · ${formatHours(session.hours)} · ${PURPOSE_LABEL[session.purpose]}`;
    sessions.append(row);
  }

  item.append(heading, meta);
  if (week.raceDate !== undefined) item.append(raceNote);
  item.append(sessions);
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

/** En rad överst i programmet: hur länge det pågår och hur mycket det är. */
function summary(program: Program): HTMLElement {
  const weeks = program.weeks.length;
  const hours = program.weeks.reduce((sum, week) => sum + week.totalHours, 0);
  const paragraph = document.createElement('p');
  paragraph.className = 'summary';
  paragraph.textContent =
    `${weeks} veckor, totalt ${hours.toLocaleString('sv-SE')} timmar. ` +
    `Första veckan börjar ${program.weeks[0]?.startDate ?? ''}.`;
  return paragraph;
}

/** "Skidloppet" med stor bokstav, för loppraden i veckovyn. */
function raceLabel(discipline: Discipline): string {
  const label = RACE_LABEL[discipline];
  return label.charAt(0).toUpperCase() + label.slice(1);
}
