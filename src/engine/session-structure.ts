/**
 * Hårda passens struktur, räknad ur passets minuter (F-10, R-15, R-30).
 *
 * **Problemet.** Tröskeltexten sa "Värm upp i 10 minuter. Kör sedan 4 × 8
 * minuter … Varva ner 10 minuter" — en fast sträng som kräver 61 minuter.
 * Planerna gav ofta 20–35. Isabelles granskning av profilerna 2026-11-15
 * hittade **77 sådana pass** över de sex profilerna. Instruktionen bad alltså
 * om något som inte fick plats i passet, vilket är värre än ett
 * tomt fält: den som försöker följa den springer över sin tid varje gång.
 *
 * **Lösningen** är att räkna fram strukturen ur minuterna och låta texten
 * vara en mall. Ett golv på passlängden gick inte: R-15 säger att
 * nedtrappningens hårda inslag är högst tjugo minuter, så tjugo minuter
 * *måste* kunna bli ett riktigt intervallpass.
 *
 * **Skalningsregeln, beslutad 2026-11-15.** Uppvärmning och nedvarvning är
 * tio minuter var, men kortas till en fjärdedel av passet var när det blir
 * trångt — aldrig under fem. Blocken behåller åtta minuter och tre minuters
 * vila så länge det går; räcker tiden inte kortas de ned mot fyra minuter och
 * vilan mot en. Alltid minst två block, annars är det inget intervallpass.
 *
 * Regeln ger upptrappningen på köpet: ett längre pass rymmer fler block, så
 * antalet växer genom fasen av sig självt. Det var SPÅRAT-guidens egen idé —
 * 4 × 5, sedan 5 × 5, sedan 6 × 5.
 */
import { rules } from './config.ts';

/** Ett hårt pass uppdelat i uppvärmning, block och nedvarvning. */
export interface HardStructure {
  /** Uppvärmning i minuter. */
  warmUp: number;
  /** Antal block, alltid minst två. */
  blocks: number;
  /** Minuter per block. */
  blockMinutes: number;
  /** Lugna minuter mellan blocken. */
  restMinutes: number;
  /** Nedvarvning i minuter. Bär också de minuter avrundningen lämnar över. */
  coolDown: number;
}

/**
 * Uppvärmningens och nedvarvningens längd.
 *
 * Tio minuter är normen. Blir passet så kort att tjugo minuter uppvärmning
 * och nedvarvning äter upp hela tiden krymper de till en fjärdedel var, med
 * fem minuter som golv — under det är det ingen uppvärmning, och att gå rakt
 * in i tröskelarbete kallt är hur man blir skadad.
 */
function warmUpMinutes(minutes: number): number {
  const { warmUpMinutes: norm, minWarmUp, warmUpShareWhenShort } = rules.hardSession;

  return Math.min(norm, Math.max(minWarmUp, Math.round(minutes * warmUpShareWhenShort)));
}

/**
 * Strukturen för ett tröskelpass, eller null när passet är för kort.
 *
 * Först prövas fullängdsblocken: så många åttaminutersblock som ryms, vilket
 * är det som gör att antalet växer när passet gör det. Ryms inte två kortas
 * blocken och vilan stegvis tills två får plats.
 */
export function tempoStructure(minutes: number): HardStructure | null {
  const { blockMinutes: fullt, restMinutes: normalVila, minBlockMinutes, minRestMinutes, minBlocks } =
    rules.hardSession;

  const upp = warmUpMinutes(minutes);
  const arbete = minutes - upp * 2;
  if (arbete <= 0) return null;

  // Så många hela block som ryms: n block och n−1 vilor.
  const ryms = Math.floor((arbete + normalVila) / (fullt + normalVila));
  if (ryms >= minBlocks) {
    return färdig(upp, ryms, fullt, normalVila, minutes);
  }

  // Annars kortas blocket först och vilan sist. Vilan är det som gör
  // intervallen till en intervall — tre minuter lugnt mellan två sjuminuters
  // block är ett bättre pass än en minut mellan två åttaminuters.
  for (let vila = normalVila; vila >= minRestMinutes; vila -= 1) {
    for (let block = fullt; block >= minBlockMinutes; block -= 1) {
      if (minBlocks * block + (minBlocks - 1) * vila <= arbete) {
        return färdig(upp, minBlocks, block, vila, minutes);
      }
    }
  }

  return null;
}

/**
 * Strukturen för ett intervallpass, eller null när passet är för kort.
 *
 * Serierna är 30 sekunder hårt och 30 sekunder vila, alltså en minut per
 * repetition. Ett block är här en serie, och `blockMinutes` antalet
 * repetitioner i den.
 */
export function intervalStructure(minutes: number): HardStructure | null {
  const { repsPerSet, minReps, restMinutes, minRestMinutes, minSets } = rules.hardSession.intervals;

  const upp = warmUpMinutes(minutes);
  const arbete = minutes - upp * 2;
  if (arbete <= 0) return null;

  const ryms = Math.floor((arbete + restMinutes) / (repsPerSet + restMinutes));
  if (ryms >= minSets) {
    return färdig(upp, ryms, repsPerSet, restMinutes, minutes);
  }

  for (let vila = restMinutes; vila >= minRestMinutes; vila -= 1) {
    for (let reps = repsPerSet; reps >= minReps; reps -= 1) {
      if (minSets * reps + (minSets - 1) * vila <= arbete) {
        return färdig(upp, minSets, reps, vila, minutes);
      }
    }
  }

  return null;
}

/**
 * Strukturen med avrundningen lagd i nedvarvningen.
 *
 * Blocken och vilorna är hela minuter, så det blir nästan alltid något över.
 * De minuterna måste hamna någonstans — annars säger texten en sak och
 * passets längd en annan, vilket är precis felet den här modulen finns för.
 */
function färdig(
  upp: number,
  blocks: number,
  blockMinutes: number,
  restMinutes: number,
  minutes: number,
): HardStructure {
  // Överskottet går till blocken, inte till nedvarvningen. Ett pass på 49
  // minuter rymmer två åttaminutersblock och fick därmed tio minuter över —
  // de hamnade i nedvarvningen, som blev tjugo minuter efter sexton minuters
  // tröskelarbete. Tiden hör till arbetet.
  //
  // Tillskottet är begränsat av sig självt: hade överskottet räckt till ett
  // block till hade ett block till fått plats, så det är alltid mindre än
  // blocket plus vilan. Med två block kan de alltså växa med högst fem
  // minuter, och inget nytt tal behövs i konfigurationen.
  const tillgängligt = minutes - upp * 2 - (blocks - 1) * restMinutes;
  const längd = Math.max(blockMinutes, Math.floor(tillgängligt / blocks));

  const arbete = blocks * längd + (blocks - 1) * restMinutes;

  return {
    warmUp: upp,
    blocks,
    blockMinutes: längd,
    restMinutes,
    coolDown: minutes - upp - arbete,
  };
}
