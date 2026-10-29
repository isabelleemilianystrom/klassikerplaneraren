import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { explanations, races } from '../src/engine/config.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { groupByPhase } from '../src/ui/plan-view.ts';
import { PROFILES } from './profiles.ts';

/**
 * Förklaringarna (A-01 till A-07).
 *
 * Texterna skrevs med AI under utvecklingen och granskades innan de gick in.
 * Testerna kontrollerar att de håller sina gränser och att de inte innehåller
 * sådant de inte får — siffror, datum eller loppnamn.
 */

describe('A-02: biblioteket täcker varje fas', () => {
  it('har en text för varje fas motorn kan producera', () => {
    const faser = new Set(
      Object.values(PROFILES)
        .flatMap((profil) => buildWeekPlans(profil))
        .map((plan) => plan.week.phase),
    );

    expect(faser.size).toBe(4);
    for (const fas of faser) {
      expect(explanations.phases[fas], fas).toBeDefined();
      expect(explanations.phases[fas].length, fas).toBeGreaterThan(0);
    }
  });

  it('har en förklaring till varje fasgrupp i varje profil', () => {
    // Saknas en fas är det ett testfel, inte ett tomt fält.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      for (const grupp of groupByPhase(buildWeekPlans(profil))) {
        expect(explanations.phases[grupp.phase], `${namn}: ${grupp.phaseId}`).toBeTruthy();
      }
    }
  });
});

describe('A-04 och A-05: längdgränserna', () => {
  it('håller sammanfattningen under 500 tecken', () => {
    expect(explanations.summary.length).toBeLessThanOrEqual(500);
    expect(explanations.summary.length).toBeGreaterThan(100);
  });

  it('håller varje fastext under 300 tecken', () => {
    for (const [fas, text] of Object.entries(explanations.phases)) {
      expect(text.length, `${fas}: ${text.length} tecken`).toBeLessThanOrEqual(300);
      expect(text.length, fas).toBeGreaterThan(50);
    }
  });
});

describe('texterna innehåller inte det de inte får', () => {
  const alla = [explanations.summary, ...Object.values(explanations.phases)];

  it('nämner inga siffror', () => {
    // Texten är densamma för alla, men planen är det inte. "Sex timmar i
    // veckan" blir fel för den som valt tre.
    for (const text of alla) {
      expect(text, text.slice(0, 40)).not.toMatch(/\d/);
    }
  });

  it('nämner inget lopp vid namn', () => {
    // Lärdomen från v0: "intervaller mot Vasaloppet" på varje rad gör ett
    // missat pass till ett missat lopp. Fokuset hör till veckan, inte texten.
    for (const race of races.races) {
      for (const text of alla) {
        expect(text, race.name).not.toContain(race.name);
      }
    }
  });

  it('lovar inga resultat och ger inga medicinska råd', () => {
    for (const text of alla) {
      expect(text).not.toMatch(/garanter|du kommer att klara|förebygger skador|läker/i);
    }
  });

  it('anklagar inte användaren för att träna för lite', () => {
    // Appen är byggd för folk som arbetar. En missad vecka ska inte kännas
    // som ett misslyckande.
    //
    // Testet letar efter anklagelsen, inte efter orden. Texten om
    // återhämtning säger "det känns ofta som för lite — det är det inte",
    // och det är precis tvärtom mot vad regeln vill förhindra.
    for (const text of alla) {
      expect(text, text.slice(0, 40)).not.toMatch(
        /du (tränar|gör|lägger) för lite|otillräckligt|du måste träna|du borde träna/i,
      );
    }
  });
});

describe('texterna är hela och på svenska', () => {
  const alla = [explanations.summary, ...Object.values(explanations.phases)];

  it('har inga förvanskade tecken', () => {
    for (const text of alla) {
      expect(text).not.toMatch(/\\u[0-9a-f]{4}/i);
      expect(text).not.toContain('�');
      expect(text).not.toMatch(/ {2}/);
    }
  });

  it('börjar med versal och slutar med skiljetecken', () => {
    for (const text of alla) {
      expect(text[0]).toBe(text[0]?.toUpperCase());
      expect(/[.!?]$/.test(text.trimEnd()), text.slice(-30)).toBe(true);
    }
  });

  it('använder svenska ord', () => {
    for (const text of alla) {
      expect(text, text.slice(0, 30)).toMatch(/[åäö]/);
    }
  });
});

describe('A-06: prompten är sparad', () => {
  it('finns i prompts/ och bär samma version som texterna', () => {
    const prompt = readFileSync('prompts/phase-explanations.v1.md', 'utf8');

    expect(prompt.length).toBeGreaterThan(500);
    expect(prompt).toContain('`v1`');
    expect(explanations.promptVersion).toBe('v1');
  });

  it('beskriver alla fyra faserna', () => {
    const prompt = readFileSync('prompts/phase-explanations.v1.md', 'utf8');

    for (const fas of ['base', 'specific', 'taper', 'recovery']) {
      expect(prompt, fas).toContain(fas);
    }
  });

  it('skriver ut längdgränserna', () => {
    const prompt = readFileSync('prompts/phase-explanations.v1.md', 'utf8');

    expect(prompt).toContain('500 tecken');
    expect(prompt).toContain('300 tecken');
  });
});

describe('A-08: ingen AI i körtid', () => {
  it('har inget beroende med "anthropic" i namnet', () => {
    // Samma krav som i project.test.ts, men här som en del av A-08.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const alla = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    for (const namn of Object.keys(alla)) {
      expect(namn.toLowerCase()).not.toContain('anthropic');
    }
  });

  it('läser texterna ur konfigurationen, inte från nätet', () => {
    const källa = readFileSync('src/engine/config.ts', 'utf8');

    expect(källa).toContain('explanations.json');
    expect(källa).not.toMatch(/fetch\(|XMLHttpRequest|api\.anthropic/);
  });
});
