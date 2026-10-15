/**
 * Startpunkt: kopplar ihop UI, generator och lagring.
 * Ingen logik här utöver sammankopplingen.
 */
import { generateProgram } from './generator';
import { clearProgram, loadProgram, saveProgram } from './storage';
import type { PlanInput } from './types';
import { renderDisclaimer, renderForm, renderProgram, scrollToCurrentWeek } from './ui/render';
import { programCreated, SOMETHING_WENT_WRONG } from './ui/texts';
import './styles.css';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function main(): void {
  const formRoot = requireElement('form-root');
  const programRoot = requireElement('program-root');
  const statusRoot = requireElement('status');
  const disclaimerRoot = requireElement('disclaimer-root');

  renderDisclaimer(disclaimerRoot);

  // Finns ett sparat program fylls formuläret med samma svar som gav det.
  // Annars kan en liten ändring skriva över hela året med standardvärden.
  const saved = loadProgram();

  renderForm(formRoot, todayIso(), {
    onSubmit: (input) => handleSubmit(input, programRoot, statusRoot),
    onReset: () => resetAll(),
    ...(saved === null ? {} : { input: saved.input }),
  });

  if (saved !== null) {
    renderProgram(programRoot, saved, todayIso());
    // Den som kommer tillbaka vill se veckan hon är i, inte vecka ett.
    scrollToCurrentWeek(programRoot);
  }
}

function handleSubmit(input: PlanInput, programRoot: HTMLElement, statusRoot: HTMLElement): void {
  const today = todayIso();
  try {
    const program = generateProgram(input, today);
    saveProgram(program);
    renderProgram(programRoot, program, today);
    announce(statusRoot, programCreated(program.weeks.length, program.weeks[0]?.startDate ?? ''));
  } catch (error) {
    programRoot.replaceChildren();
    announce(statusRoot, error instanceof Error ? error.message : SOMETHING_WENT_WRONG, true);
  }
}

/**
 * Skriver statusraden och flyttar fokus dit.
 *
 * Fokus gör att meddelandet läses upp och att användaren hamnar vid det, i
 * stället för att det dyker upp tusentals pixlar längre ner på sidan.
 */
function announce(statusRoot: HTMLElement, text: string, isError = false): void {
  statusRoot.textContent = text;
  statusRoot.hidden = false;
  statusRoot.classList.toggle('status-error', isError);
  statusRoot.focus();
}

/** Rensar sparat program och börjar om från formulärets standardvärden. */
function resetAll(): void {
  clearProgram();
  window.location.reload();
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Hittar inte elementet #${id} i index.html`);
  return element;
}

main();
