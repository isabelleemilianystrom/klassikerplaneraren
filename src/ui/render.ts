/**
 * Rendering och händelsehantering. Allt DOM-beroende bor här.
 * Ingen genereringslogik och ingen lagring i den här filen.
 */
import {
  DISCIPLINES,
  WEEKDAYS,
  type Goal,
  type Weekday,
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
import { programToIcs } from '../ics';
import { ICS_LABELS } from './ics-labels';
import {
  CLASSIC_WINDOW_HELP,
  DISCIPLINE_LABEL,
  DISCLAIMER,
  ENGELBREKTSLOPPET_HELP,
  ENGELBREKTSLOPPET_LABEL,
  EQUIPMENT_HELP,
  EQUIPMENT_LABEL,
  EXPORT_HELP,
  EXPORT_LABEL,
  ICS_FILENAME,
  GOAL_HELP,
  GOAL_LABEL,
  DAYS_PER_WEEK_LABEL,
  LONG_DAY_LABEL,
  INTENSITY_SHORT,
  OPEN_WATER_END_LABEL,
  OPEN_WATER_HELP,
  OPEN_WATER_LEGEND,
  OPEN_WATER_START_LABEL,
  OPEN_WATER_TAG,
  PRIORITY_HELP,
  PRIORITY_LABEL,
  SESSION_KIND_LABEL,
  STRUCTURE_LABEL,
  TRAINING_DAYS_HELP,
  TRAINING_DAYS_LEGEND,
  UNAVAILABLE_DAYS_LABEL,
  WEEKDAY_LABEL,
  blockHeading,
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
  races.append(racesLegend, help(CLASSIC_WINDOW_HELP), help(GOAL_HELP));

  for (const discipline of DISCIPLINES) {
    races.append(raceRow(discipline, today));
  }
  races.append(suggestionRow(form, today));
  form.append(races);

  form.append(snowSeasonFieldset());
  form.append(openWaterFieldset());
  form.append(trainingDaysFieldset());
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
/**
 * När användaren kommer åt öppet vatten.
 *
 * Samma form som snöperioden: ett månadsintervall. Simning i bassäng förbereder
 * inte för våtdräkt, kallt vatten och att sikta utan linjer.
 */
function openWaterFieldset(): HTMLElement {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = OPEN_WATER_LEGEND;
  fieldset.append(legend, help(OPEN_WATER_HELP));

  const row = document.createElement('div');
  row.className = 'row';
  row.append(monthField('openWaterStart', OPEN_WATER_START_LABEL, 6));
  row.append(monthField('openWaterEnd', OPEN_WATER_END_LABEL, 8));
  fieldset.append(row);

  return fieldset;
}

/** När användaren kan träna: antal dagar, långpassdag och omöjliga dagar. */
function trainingDaysFieldset(): HTMLElement {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = TRAINING_DAYS_LEGEND;
  fieldset.append(legend, help(TRAINING_DAYS_HELP));

  const row = document.createElement('div');
  row.className = 'row';

  const daysLabel = document.createElement('label');
  daysLabel.textContent = DAYS_PER_WEEK_LABEL;
  const days = document.createElement('input');
  days.type = 'number';
  days.name = 'daysPerWeek';
  days.min = '2';
  days.max = '7';
  days.step = '1';
  days.value = '4';
  days.required = true;
  daysLabel.append(days);

  const longLabel = document.createElement('label');
  longLabel.textContent = LONG_DAY_LABEL;
  const long = document.createElement('select');
  long.name = 'longSessionDay';
  for (const day of WEEKDAYS) {
    const option = document.createElement('option');
    option.value = String(day);
    option.textContent = WEEKDAY_LABEL[day] ?? String(day);
    option.selected = day === 7;
    long.append(option);
  }
  longLabel.append(long);

  row.append(daysLabel, longLabel);
  fieldset.append(row);

  const unavailable = document.createElement('div');
  unavailable.className = 'row days';
  const unavailableLabel = document.createElement('p');
  unavailableLabel.className = 'field-label';
  unavailableLabel.textContent = UNAVAILABLE_DAYS_LABEL;
  fieldset.append(unavailableLabel);
  for (const day of WEEKDAYS) {
    unavailable.append(checkbox(`unavailable-${day}`, WEEKDAY_LABEL[day] ?? String(day)));
  }
  fieldset.append(unavailable);

  return fieldset;
}

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

  const goalLabel = document.createElement('label');
  goalLabel.textContent = 'Ditt mål';
  const goal = document.createElement('select');
  goal.name = `goal-${discipline}`;
  for (const [value, text] of Object.entries(GOAL_LABEL)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    goal.append(option);
  }
  goalLabel.append(goal);

  row.append(dateLabel, levelLabel, goalLabel);
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

  const goals = {} as PlanInput['goals'];
  for (const discipline of DISCIPLINES) {
    races[discipline] = String(data.get(`race-${discipline}`) ?? '');
    levels[discipline] = String(data.get(`level-${discipline}`) ?? 'beginner') as Level;
    goals[discipline] = String(data.get(`goal-${discipline}`) ?? 'finish') as Goal;
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
    openWaterSeason: {
      startMonth: Number(data.get('openWaterStart') ?? 6),
      endMonth: Number(data.get('openWaterEnd') ?? 8),
    },
    equipment: {
      skiErgometer: data.get('equipment-skiErgometer') !== null,
      rollerSkis: data.get('equipment-rollerSkis') !== null,
      indoorTrainer: data.get('equipment-indoorTrainer') !== null,
    },
    goals,
    trainingDays: {
      daysPerWeek: Number(data.get('daysPerWeek') ?? 4),
      longSessionDay: Number(data.get('longSessionDay') ?? 7) as Weekday,
      unavailableDays: WEEKDAYS.filter((day) => data.get(`unavailable-${day}`) !== null),
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

  container.append(summary(program), exportButton(program));

  // Veckorna grupperas i block. Fokuset står på blocket, inte på passen — det
  // ska gå att missa ett pass utan att känna att man missat loppet.
  for (const [index, block] of program.blocks.entries()) {
    const weeks = program.weeks.filter((week) => week.block === index);
    if (weeks.length === 0) continue;

    const heading = document.createElement('h2');
    heading.className = 'block-heading';
    heading.textContent = blockHeading(
      index,
      block.focus.map((discipline) => raceLabel(discipline)),
    );

    const span = document.createElement('p');
    span.className = 'block-span';
    span.textContent = `${weeks.length} veckor · ${block.startDate} till ${block.endDate}`;

    const list = document.createElement('ol');
    list.className = 'weeks';
    for (const week of weeks) {
      list.append(weekItem(week, program.weeks.indexOf(week) + 1));
    }

    container.append(heading, span, list);
  }

  const priorityNote = document.createElement('p');
  priorityNote.className = 'help priority-note';
  priorityNote.textContent = PRIORITY_HELP;
  container.append(priorityNote);
}

function weekItem(week: Week, number: number): HTMLElement {
  const item = document.createElement('li');
  item.className = 'week';

  const heading = document.createElement('h3');
  heading.textContent = `Vecka ${number} — ${PHASE_LABEL[week.phase]}`;

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
  const byDay = [...week.sessions].sort((a, b) => a.day - b.day);
  for (const session of byDay) {
    const row = document.createElement('li');
    row.className = session.priority === 'key' ? 'session key' : 'session';

    const tag = document.createElement('span');
    tag.className = 'session-kind';
    tag.textContent = SESSION_KIND_LABEL[session.kind];

    const what = session.substitute
      ? `${DISCIPLINE_LABEL[session.discipline]} (${SUBSTITUTE_LABEL[session.substitute]})`
      : DISCIPLINE_LABEL[session.discipline];

    const openWater = session.openWater === true ? ` (${OPEN_WATER_TAG})` : '';
    // Zon på ett styrkepass säger ingenting — den hör till konditionsträning.
    const zone = session.kind === 'strength' ? '' : ` · ${INTENSITY_SHORT[session.intensity]}`;
    const text = document.createElement('span');
    text.textContent =
      `${WEEKDAY_LABEL[session.day] ?? ''} · ${what}${openWater} · ${formatHours(session.hours)} · ` +
      `${PURPOSE_LABEL[session.purpose]}${zone}`;

    const structure = document.createElement('span');
    structure.className = 'session-structure';
    structure.textContent = STRUCTURE_LABEL[session.structure];

    const priority = document.createElement('span');
    priority.className = 'session-priority';
    priority.textContent = PRIORITY_LABEL[session.priority];

    row.append(tag, text, priority, structure);
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

/**
 * Knappen som laddar ner programmet som kalenderfil.
 *
 * Filen byggs i webbläsaren och lämnar aldrig datorn — det finns ingen server
 * att skicka den till.
 */
function exportButton(program: Program): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'export';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary';
  button.textContent = EXPORT_LABEL;
  button.addEventListener('click', () => downloadIcs(program));

  wrapper.append(button, help(EXPORT_HELP));
  return wrapper;
}

function downloadIcs(program: Program): void {
  const blob = new Blob([programToIcs(program, ICS_LABELS)], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = ICS_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
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
