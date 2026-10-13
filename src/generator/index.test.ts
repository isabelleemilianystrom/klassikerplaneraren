import { describe, expect, it } from 'vitest';
import { generateProgram } from './index';
import type { PlanInput } from '../types';

const input: PlanInput = {
  races: {
    skiing: '2027-03-07',
    cycling: '2026-06-19',
    swimming: '2026-07-04',
    running: '2026-09-26',
  },
  levels: {
    skiing: 'beginner',
    cycling: 'intermediate',
    swimming: 'beginner',
    running: 'advanced',
  },
  hoursPerWeek: 6,
};

describe('generateProgram', () => {
  // Ta bort det här testet när genereringen är implementerad.
  it('är inte implementerad än och säger det tydligt', () => {
    expect(() => generateProgram(input, '2026-01-05')).toThrow(/inte implementerad/i);
  });

  // Invarianterna nedan är kravspecen för genereringen (se CLAUDE.md).
  // Implementera dem ett i taget och byt it.todo mot ett riktigt test.
  it.todo('täcker hela perioden från dagens datum till det sista loppet');
  it.todo('håller varje veckas totala timmar inom hoursPerWeek');
  it.todo('lägger en nedtrappningsvecka före varje lopp');
  it.todo('lägger en återhämtningsvecka efter varje lopp');
  it.todo('toppar formen separat mot alla fyra loppen');
  it.todo('ersätter skidpass med stakmaskin eller rullskidor utanför vintersäsong');
  it.todo('tar aldrig bort en gren helt ur programmet');
  it.todo('ger varje pass gren, omfattning och syfte');
  it.todo('ger samma program för samma indata och samma dagens datum');
  it.todo('startar varje vecka på en måndag');
});
