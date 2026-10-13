/**
 * All svensk text som visas för användaren, samlad på ett ställe.
 * Logiken i src/generator/ hanterar nycklar, aldrig färdiga strängar.
 */
import type { Discipline, Phase, SessionPurpose, Substitute } from '../types';

export const APP_NAME = 'Klassikerplaneraren';

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  skiing: 'Längdskidor',
  cycling: 'Cykel',
  swimming: 'Simning',
  running: 'Löpning',
};

export const RACE_LABEL: Record<Discipline, string> = {
  skiing: 'Vasaloppet',
  cycling: 'Vätternrundan',
  swimming: 'Vansbrosimningen',
  running: 'Lidingöloppet',
};

export const PHASE_LABEL: Record<Phase, string> = {
  base: 'Uppbyggnad',
  build: 'Uppbyggnad',
  peak: 'Toppning',
  taper: 'Nedtrappning',
  recovery: 'Återhämtning',
};

export const PURPOSE_LABEL: Record<SessionPurpose, string> = {
  easy: 'Lugnt distanspass',
  endurance: 'Uthållighet',
  longSession: 'Långpass',
  intervals: 'Intervaller',
  technique: 'Teknik',
  strength: 'Styrka',
  rest: 'Vila',
};

export const SUBSTITUTE_LABEL: Record<Substitute, string> = {
  skiErgometer: 'stakmaskin',
  rollerSkis: 'rullskidor',
};

export const LEVEL_LABEL = {
  beginner: 'Nybörjare',
  intermediate: 'Vana',
  advanced: 'Rutinerad',
} as const;

export const DISCLAIMER =
  'Programmet är ett automatiskt förslag och ersätter inte medicinsk rådgivning. ' +
  'Rådgör med läkare innan du börjar träna hårt, särskilt vid sjukdom, skada eller graviditet.';
