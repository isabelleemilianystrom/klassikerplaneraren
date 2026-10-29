import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sessions as sessionTexts } from '../src/engine/config.ts';
import { FIXED } from '../src/ui/texts.ts';

/**
 * Texterna i avsnitt 8 ska användas **ordagrant**.
 *
 * Testet läser kravspecen och jämför. Det är med flit gjort så, och inte med
 * inklistrade strängar: ändras texten på ena stället utan det andra går testet
 * sönder, i stället för att de två tyst glider isär.
 *
 * I v0 blev två varningstexter förvanskade av felaktiga unicode-escaper, och
 * felet upptäcktes först av en användare. Det här testet fångar hela den
 * klassen av fel.
 */

const SPEC = readFileSync('docs/kravspec-v1.md', 'utf8');

/**
 * Raderna i avsnitt 8:s tabell över fasta texter.
 *
 * Tabellen börjar med sin rubrikrad och slutar vid första raden som inte hör
 * till den. Att leta i hela dokumentet fångar andra tabeller — kravens tabell
 * innehåller också ordet "Startsida".
 */
function tabellrader(): string[] {
  const rader = SPEC.split('\n');
  const start = rader.findIndex((rad) => rad.startsWith('| Text | Var | Innehåll |'));
  if (start === -1) throw new Error('Avsnitt 8 saknar tabellen över fasta texter');

  const resultat: string[] = [];

  // +2 hoppar över rubrikraden och markdowns avgränsare.
  for (let i = start + 2; i < rader.length; i += 1) {
    const rad = rader[i] as string;
    if (!rad.startsWith('|')) break;
    resultat.push(rad);
  }

  return resultat;
}

/**
 * Innehållet i en rad i tabellen över fasta texter.
 *
 * Raderna ser ut som `| Namn | Var | Innehåll |`. Innehållet kan själv
 * innehålla markdown, men inga rörstreck — det är vad som gör uppdelningen
 * säker.
 */
function textFrånSpecen(namn: string): string {
  const rad = tabellrader().find((kandidat) => kandidat.startsWith(`| ${namn} |`));
  if (rad === undefined) throw new Error(`Avsnitt 8 saknar raden "${namn}"`);

  const kolumner = rad.split('|').map((del) => del.trim());
  const innehåll = kolumner[3];
  if (innehåll === undefined || innehåll === '') {
    throw new Error(`Raden "${namn}" saknar innehåll`);
  }

  // Ändringsmarkeringar som *(utökad 2026-10-28)* hör till kravspecen, inte
  // till texten användaren ser.
  return innehåll.replace(/\s*\*\([^)]*\)\*\s*$/, '').trim();
}

describe('avsnitt 8: texterna används ordagrant', () => {
  it('ansvarsfriskrivningen', () => {
    expect(FIXED.disclaimer).toBe(textFrånSpecen('Ansvarsfriskrivning'));
  });

  it('åldersgränsen', () => {
    expect(FIXED.ageLimit).toBe(textFrånSpecen('Åldersgräns'));
  });

  it('röda flaggor', () => {
    expect(FIXED.redFlags).toBe(textFrånSpecen('Röda flaggor'));
  });

  it('smärtregeln', () => {
    expect(FIXED.painRule).toBe(textFrånSpecen('Smärtregel'));
  });

  it('sjukdomsregeln', () => {
    expect(FIXED.illness).toBe(textFrånSpecen('Sjukdom'));
  });

  it('AI-märkningen', () => {
    expect(FIXED.aiMarking).toBe(textFrånSpecen('AI-märkning'));
  });

  it('oberoendetexten', () => {
    expect(FIXED.independence).toBe(textFrånSpecen('Oberoende'));
  });

  it('säkerhetstexten för öppet vatten', () => {
    // Den ligger i config/sessions.json, eftersom motorn sätter den på passen.
    expect(sessionTexts.safetyNotes.openWater.text).toBe(textFrånSpecen('Öppet vatten'));
  });

  it('täcker varje rad i tabellen', () => {
    // Nya texter i avsnitt 8 ska också komma in i appen. Finns en rad som
    // inget test täcker är det ett fel här, inte i kravspecen.
    const rader = tabellrader().map((rad) => (rad.split('|')[1] as string).trim());

    expect(new Set(rader)).toEqual(
      new Set([
        'Ansvarsfriskrivning',
        'Åldersgräns',
        'Röda flaggor',
        'Smärtregel',
        'Sjukdom',
        'Öppet vatten',
        'AI-märkning',
        'Oberoende',
      ]),
    );
  });
});

describe('texterna är hela', () => {
  it('har inga förvanskade tecken', () => {
    // v0-felet: å skrevs ut som literal text i stället för å, och
    // "långpassen" blev "l00e5ngpassen". Svenska texter utan å, ä eller ö är
    // misstänkta, och escapesekvenser i klartext är alltid fel.
    for (const [namn, text] of Object.entries(FIXED)) {
      expect(text, namn).not.toMatch(/\\u[0-9a-f]{4}/i);
      expect(text, namn).not.toMatch(/[0-9a-f]{2}e5|[0-9a-f]{2}e4|[0-9a-f]{2}f6/i);
      expect(text, namn).not.toContain('\\n');
      expect(text, namn).not.toContain('�');
    }
  });

  it('börjar med versal och slutar med punkt', () => {
    for (const [namn, text] of Object.entries(FIXED)) {
      expect(text[0], namn).toBe(text[0]?.toUpperCase());
      expect(text.trimEnd().endsWith('.'), `${namn}: "${text.slice(-40)}"`).toBe(true);
    }
  });

  it('har inga dubbla mellanslag', () => {
    // Texterna sätts ihop av flera rader i koden; ett glömt mellanslag syns.
    for (const [namn, text] of Object.entries(FIXED)) {
      expect(text, namn).not.toMatch(/ {2}/);
    }
  });

  it('har inga ihopskrivna ord', () => {
    // Motsatsen: ett saknat mellanslag vid en radbrytning i koden.
    for (const [namn, text] of Object.entries(FIXED)) {
      expect(text, namn).not.toMatch(/[a-zåäö][A-ZÅÄÖ]/);
    }
  });
});

describe('K-01 och K-11: texterna står där avsnitt 8 säger', () => {
  /**
   * Vilka texter en komponent använder.
   *
   * Testet läser källkoden. Det är trubbigt — det kontrollerar att texten
   * refereras, inte att den syns på skärmen — men det fångar det som faktiskt
   * brukar hända: att någon tar bort en säkerhetstext ur en vy.
   */
  function användaTexter(fil: string): Set<string> {
    const källa = readFileSync(fil, 'utf8');
    const träffar = källa.matchAll(/FIXED\.(\w+)/g);
    return new Set([...träffar].map((träff) => träff[1] as string));
  }

  const START = användaTexter('src/app/page.tsx');
  const PLAN = användaTexter('src/ui/PlanView.tsx');

  it('har ansvarsfriskrivningen på startsidan och i planens fot', () => {
    expect(START).toContain('disclaimer');
    expect(PLAN).toContain('disclaimer');
  });

  it('har åldersgränsen på startsidan', () => {
    expect(START).toContain('ageLimit');
  });

  it('har röda flaggor, smärtregeln och sjukdomsregeln i planen', () => {
    expect(PLAN).toContain('redFlags');
    expect(PLAN).toContain('painRule');
    expect(PLAN).toContain('illness');
  });

  it('har oberoendetexten i planens fot', () => {
    expect(PLAN).toContain('independence');
  });

  it('har ännu inte AI-märkningen', () => {
    // Den hör till förklaringarna, som skrivs i T-12. Testet finns för att
    // påminna: kommer texten in i appen ska den stå vid förklaringarna.
    expect(START.has('aiMarking') || PLAN.has('aiMarking')).toBe(false);
  });
});
