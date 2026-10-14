/**
 * De svenska texterna som kalenderexporten behöver.
 *
 * `ics.ts` äger inget språk — den tar emot etiketterna. Den här filen är bron
 * mellan UI:ts texter och exporten.
 */
import type { IcsLabels } from '../ics';
import {
  APP_NAME,
  DISCIPLINE_LABEL,
  DISCLAIMER,
  INTENSITY_SHORT,
  OPEN_WATER_TAG,
  PURPOSE_LABEL,
  RACE_LABEL,
  STRUCTURE_LABEL,
  SUBSTITUTE_LABEL,
} from './texts';

export const ICS_LABELS: IcsLabels = {
  calendarName: APP_NAME,
  discipline: DISCIPLINE_LABEL,
  purpose: PURPOSE_LABEL,
  structure: STRUCTURE_LABEL,
  intensity: INTENSITY_SHORT,
  substitute: SUBSTITUTE_LABEL,
  race: RACE_LABEL,
  openWater: OPEN_WATER_TAG,
  keySession: 'Nyckelpass — prioritera det här passet.',
  supportingSession: 'Stödpass — stryk det här först om veckan inte räcker till.',
  disclaimer: DISCLAIMER,
};
