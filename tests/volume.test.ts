import { describe, expect, it } from 'vitest';
import { raceById, rules } from '../src/engine/config.ts';
import { buildWeekPlans } from '../src/engine/sessions.ts';
import { trainingSpeedKmh, volumeChecks, volumeWarnings } from '../src/engine/volume.ts';
import type { PlanInput } from '../src/engine/types.ts';
import { P1, P2, P3, P4, P5, P6, PROFILES } from './profiles.ts';

function kontroller(input: PlanInput) {
  return volumeChecks(input, buildWeekPlans(input));
}

describe('R-34: volymriktmärken', () => {
  it('räknar bara de lopp som har ett riktmärke', () => {
    // Bara Vätternrundan har ett tal i dag. De övriga lämnas tomma hellre än
    // gissade, och ska då inte ge någon kontroll alls.
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const medRiktmärke = profil.races.filter(
        (race) => raceById(race.id).volumeMilestoneKm !== undefined,
      );
      expect(kontroller(profil).length, namn).toBe(medRiktmärke.length);
    }
  });

  it('summerar alla pass i grenen, inte bara långpasset', () => {
    // Riktmärket är 1000 km sammanlagt, inte 1000 km på en gång.
    const check = kontroller(P2)[0];
    const planer = buildWeekPlans(P2);
    const längsta = Math.max(
      ...planer
        .flatMap((plan) => plan.sessions)
        .filter((session) => session.sport === 'bike' && session.type === 'long')
        .map((session) => session.minutes),
    );

    expect(check?.minutes).toBeGreaterThan(längsta * 5);
  });

  it('räknar all träning fram till loppdagen, loppet undantaget', () => {
    const planer = buildWeekPlans(P2);
    const lopp = planer
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'race' && session.sport === 'bike');

    const check = kontroller(P2)[0];
    const alltFöre = planer
      .flatMap((plan) => plan.sessions)
      .filter(
        (session) =>
          session.sport === 'bike' &&
          session.type !== 'rest' &&
          session.date < (lopp?.date as string),
      )
      .reduce((summa, session) => summa + session.minutes, 0);

    expect(check?.minutes).toBe(alltFöre);

    // Loppets egna 660 minuter ligger utanför — annars hade riktmärket på
    // 1000 km blivit nästan gratis.
    expect(check?.minutes).toBeLessThan(alltFöre + (lopp?.minutes as number));
  });

  it('räknar inte tid efter loppet', () => {
    // P2 har cykelpass kvar efter Vätternrundan, under Vansbro- och
    // Lidingöblocken. De hör inte till förberedelsen.
    const planer = buildWeekPlans(P2);
    const lopp = planer
      .flatMap((plan) => plan.sessions)
      .find((session) => session.type === 'race' && session.sport === 'bike');

    const efter = planer
      .flatMap((plan) => plan.sessions)
      .filter(
        (session) =>
          session.sport === 'bike' &&
          session.type !== 'rest' &&
          session.type !== 'race' &&
          session.date > (lopp?.date as string),
      );

    expect(efter.length).toBeGreaterThan(0);

    const allt = planer
      .flatMap((plan) => plan.sessions)
      .filter((session) => session.sport === 'bike' && session.type !== 'rest')
      .reduce((summa, session) => summa + session.minutes, 0);

    expect(kontroller(P2)[0]?.minutes).toBeLessThan(allt);
  });

  it('räknar om tid till kilometer med grenens träningsfart', () => {
    const fart = trainingSpeedKmh('bike') as number;
    expect(fart).toBe(rules.trainingSpeedKmh.bike);

    const check = kontroller(P2)[0];
    expect(check?.kilometers).toBe(Math.round(((check?.minutes as number) / 60) * fart));
  });

  it('ger ingen fart för grenar som saknar en', () => {
    // Bara cykeln har ett tal. Att gissa skidors eller simningens fart skulle
    // ge ett riktmärke som ser exakt ut men inte är belagt.
    expect(trainingSpeedKmh('ski')).toBeNull();
    expect(trainingSpeedKmh('swim')).toBeNull();
    expect(trainingSpeedKmh('run')).toBeNull();
  });

  it('når riktmärket med tio timmar i veckan', () => {
    const check = kontroller(P2)[0];
    expect(check?.reached).toBe(true);
    expect(check?.kilometers).toBeGreaterThanOrEqual(1000);
  });

  it('når det inte med tre timmar i veckan', () => {
    const check = kontroller(P3)[0];
    expect(check?.reached).toBe(false);
  });

  it('når det inte när förberedelsetiden är kort', () => {
    // P6 startar 3 maj och Vätternrundan är 18 juni: sex och en halv vecka.
    // Åtta timmar i veckan räcker inte på den tiden, hur bra planen än är.
    const check = kontroller(P6)[0];
    expect(check?.reached).toBe(false);
  });

  it('hoppar över lopp som inte ingår i planen', () => {
    // P4 har bara Vasaloppet, som inte har något riktmärke.
    expect(kontroller(P4)).toEqual([]);
  });

  it('växer med fler timmar i veckan', () => {
    const fler: PlanInput = { ...P3, hoursPerWeek: 12 };
    expect((kontroller(fler)[0]?.kilometers as number)).toBeGreaterThan(
      kontroller(P3)[0]?.kilometers as number,
    );
  });
});

describe('R-34: varningstexten', () => {
  it('ges bara när riktmärket inte nås', () => {
    expect(volumeWarnings(kontroller(P2))).toEqual([]);
    expect(volumeWarnings(kontroller(P3)).length).toBe(1);
  });

  it('säger vad planen ger och vad riktmärket är', () => {
    const varning = volumeWarnings(kontroller(P3))[0] as string;
    const check = kontroller(P3)[0];

    expect(varning).toContain(String(check?.kilometers));
    expect(varning).toContain('1000');
    expect(varning).toContain('Vätternrundan');
    expect(varning).toContain('cykel');
  });

  it('har inga ersättningsmarkörer kvar', () => {
    for (const profil of Object.values(PROFILES)) {
      for (const varning of volumeWarnings(kontroller(profil))) {
        expect(varning).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('säger att planen når distansen, inte att användaren tränar för lite', () => {
    // Appen är byggd för folk som arbetar. En varning betyder "det här når inte
    // riktmärket", aldrig "du tränar för lite".
    const varning = volumeWarnings(kontroller(P3))[0] as string;

    expect(varning).toContain('klara distansen');
    expect(varning).not.toMatch(/för lite|otillräckligt|borde träna mer/i);
  });

  it('är samma text för samma plan', () => {
    for (const profil of [P1, P3, P5, P6]) {
      expect(volumeWarnings(kontroller(profil))).toEqual(volumeWarnings(kontroller(profil)));
    }
  });
});
