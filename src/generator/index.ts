/**
 * Programgenerering. Rena funktioner: indata in, program ut.
 *
 * Inga sidoeffekter här — ingen localStorage, ingen DOM, inget nätverk och
 * inget `new Date()`. Dagens datum skickas in som argument (`today`) så att
 * genereringen är deterministisk och testbar.
 */
import type { IsoDate, PlanInput, Program } from '../types';
import { buildTimeline } from './timeline';

export { buildTimeline, lastRaceDate, weekIndexOf } from './timeline';

/**
 * Genererar ett komplett träningsprogram.
 *
 * TODO: inte implementerad än. Steg 1, tidslinjen, finns i `./timeline` och
 * anropas nedan — det som saknas är faser, pass och säsongsanpassning.
 *
 * Reglerna som ska gälla (se CLAUDE.md):
 *  - Fyra grenar, fyra loppdatum. Varje lopp får sin egen topp.
 *  - Nedtrappning före varje lopp och återhämtning efter varje lopp är
 *    obligatoriska, även när nästa lopp ligger nära.
 *  - Veckovolymen överstiger aldrig input.hoursPerWeek.
 *  - Skidpass utanför vintersäsong ersätts med stakmaskin eller rullskidor,
 *    de tas aldrig bort.
 *  - Varje pass har gren, omfattning och ett syfte.
 */
export function generateProgram(input: PlanInput, today: IsoDate): Program {
  // Validerar indatum och ger veckorna som ska fyllas. Kastar vid ogiltiga datum.
  buildTimeline(input.races, today);
  throw new Error('Genereringen är inte implementerad än.');
}
