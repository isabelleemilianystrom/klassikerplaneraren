/**
 * Rendering och händelsehantering. Allt DOM-beroende bor här.
 * Ingen genereringslogik och ingen lagring i den här filen.
 */
import { DISCIPLINES, type Discipline, type Level, type PlanInput, type Program, type Week } from '../types';
import {
  DISCIPLINE_LABEL,
  DISCLAIMER,
  LEVEL_LABEL,
  PHASE_LABEL,
  PURPOSE_LABEL,
  RACE_LABEL,
  SUBSTITUTE_LABEL,
} from './texts';

const LEVELS: readonly Level[] = ['beginner', 'intermediate', 'advanced'];

/** Ritar formuläret och kopplar submit till `onSubmit`. */
export function renderForm(container: HTMLElement, onSubmit: (input: PlanInput) => void): void {
  const form = document.createElement('form');
  form.className = 'plan-form';
  form.noValidate = false;

  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Dina lopp och din nivå';
  fieldset.append(legend);

  for (const discipline of DISCIPLINES) {
    fieldset.append(raceRow(discipline));
  }
  form.append(fieldset);

  form.append(hoursRow());

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = 'Skapa program';
  form.append(submit);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSubmit(readForm(form));
  });

  container.append(form);
}

function raceRow(discipline: Discipline): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';

  const dateLabel = document.createElement('label');
  dateLabel.textContent = `${RACE_LABEL[discipline]} (${DISCIPLINE_LABEL[discipline].toLowerCase()})`;
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
  return row;
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

  return {
    races,
    levels,
    hoursPerWeek: Number(data.get('hoursPerWeek') ?? 0),
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
