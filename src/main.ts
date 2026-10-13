/**
 * Startpunkt: kopplar ihop UI, generator och lagring.
 * Ingen logik här utöver sammankopplingen.
 */
import { generateProgram } from './generator';
import { loadProgram, saveProgram } from './storage';
import type { PlanInput, Program } from './types';
import { message, renderDisclaimer, renderForm, renderProgram } from './ui/render';
import './styles.css';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function main(): void {
  const formRoot = requireElement('form-root');
  const programRoot = requireElement('program-root');
  const disclaimerRoot = requireElement('disclaimer-root');

  renderDisclaimer(disclaimerRoot);
  renderForm(formRoot, (input) => handleSubmit(input, programRoot));

  const saved = loadProgram();
  if (saved) {
    showProgram(saved, programRoot);
  }
}

function handleSubmit(input: PlanInput, programRoot: HTMLElement): void {
  try {
    const program = generateProgram(input, todayIso());
    saveProgram(program);
    showProgram(program, programRoot);
  } catch (error) {
    programRoot.replaceChildren(
      message(error instanceof Error ? error.message : 'Något gick fel när programmet skulle skapas.'),
    );
  }
}

function showProgram(program: Program, programRoot: HTMLElement): void {
  renderProgram(programRoot, program);
}

function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Hittar inte elementet #${id} i index.html`);
  return element;
}

main();
