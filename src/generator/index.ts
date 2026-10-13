/**
 * Programgenerering. Rena funktioner: indata in, program ut.
 *
 * Inga sidoeffekter här — ingen localStorage, ingen DOM, inget nätverk och
 * inget `new Date()`. Dagens datum skickas in som argument (`today`) så att
 * genereringen är deterministisk och testbar.
 */
import type { IsoDate, PlanInput, Program } from '../types';

/**
 * Genererar ett komplett träningsprogram.
 *
 * TODO: inte implementerad än. Reglerna som ska gälla (se CLAUDE.md):
 *  - Fyra grenar, fyra loppdatum. Varje lopp får sin egen topp.
 *  - Nedtrappning före varje lopp och återhämtning efter varje lopp är
 *    obligatoriska, även när nästa lopp ligger nära.
 *  - Veckovolymen överstiger aldrig input.hoursPerWeek.
 *  - Skidpass utanför vintersäsong ersätts med stakmaskin eller rullskidor,
 *    de tas aldrig bort.
 *  - Varje pass har gren, omfattning och ett syfte.
 */
export function generateProgram(_input: PlanInput, _today: IsoDate): Program {
  throw new Error('Genereringen är inte implementerad än.');
}
