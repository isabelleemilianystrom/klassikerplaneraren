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

  it('nås på golvet i R-41, när hela året finns kvar', () => {
    // P3 ligger på sex timmar, minsta tid ett program byggs av. Räckte inte
    // den tiden till tusen kilometer på ett år vore golvet satt för lågt.
    const check = kontroller(P3)[0];
    expect(check?.reached).toBe(true);
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
    expect(volumeWarnings(kontroller(P3))).toEqual([]);
    // P6 startar sex och en halv vecka före Vätternrundan och hinner inte.
    expect(volumeWarnings(kontroller(P6)).length).toBe(1);
  });

  it('säger vad planen ger och vad riktmärket är', () => {
    const varning = volumeWarnings(kontroller(P6))[0] as string;
    const check = kontroller(P6)[0];

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
    const varning = volumeWarnings(kontroller(P6))[0] as string;

    expect(varning).toContain('klara distansen');
    expect(varning).not.toMatch(/för lite|otillräckligt|borde träna mer/i);
  });

  it('är samma text för samma plan', () => {
    for (const profil of [P1, P3, P5, P6]) {
      expect(volumeWarnings(kontroller(profil))).toEqual(volumeWarnings(kontroller(profil)));
    }
  });
});


describe('R-48: uppmuntran på långpasset när riktmärket inte nås', () => {
  const TEXT = rules.warnings.volumeMilestone.sessionEncouragement;

  /** En plan med knapp tid: P1 men med start i januari. */
  const knappTid: PlanInput = { ...P1, startDate: '2027-01-04', today: '2027-01-04' };

  function pass(input: PlanInput) {
    return buildWeekPlans(input).flatMap((plan) => plan.sessions);
  }

  function medUppmuntran(input: PlanInput) {
    const bit = TEXT.trim().slice(0, 30);
    return pass(input).filter((session) => session.instruction?.includes(bit) === true);
  }

  it('har texten i konfigurationen med sina platshållare', () => {
    expect(TEXT).toContain('{race}');
    expect(TEXT).toContain('{milestone}');

    // Tonen: ett erbjudande, inte ett krav. Planen räcker ändå.
    expect(TEXT).toContain('klara distansen');
    expect(TEXT).not.toMatch(/du måste|du borde|för lite|otillräckligt/i);
  });

  it('lägger uppmuntran på långpassen när planen inte når riktmärket', () => {
    const check = kontroller(knappTid)[0];
    expect(check?.reached).toBe(false);

    const uppmuntrade = medUppmuntran(knappTid);
    expect(uppmuntrade.length).toBeGreaterThan(0);

    for (const session of uppmuntrade) {
      expect(session.type, session.id).toBe('long');
      expect(session.sport, session.id).toBe(check?.sport);
    }
  });

  it('nämner loppet och riktmärket, utan platshållare kvar', () => {
    const check = kontroller(knappTid)[0];

    for (const session of medUppmuntran(knappTid)) {
      expect(session.instruction, session.id).toContain(raceById(check?.raceId as never).name);
      expect(session.instruction, session.id).toContain(String(check?.milestoneKm));
      expect(session.instruction, session.id).not.toMatch(/\{\w+\}/);
    }
  });

  it('säger ingenting när riktmärket nås', () => {
    // P2 cyklar långt över tusen kilometer. Att uppmuntra henne till mer vore
    // att göra varningen till brus.
    const check = kontroller(P2)[0];
    expect(check?.reached).toBe(true);
    expect(medUppmuntran(P2)).toEqual([]);
  });

  it('lägger ingen uppmuntran på pass efter loppet', () => {
    // Efter loppet är riktmärket inte längre något att närma sig.
    const lopp = knappTid.races.find((race) => race.id === 'vatternrundan')?.date as string;

    for (const session of medUppmuntran(knappTid)) {
      expect(session.date < lopp, `${session.id} ${session.date}`).toBe(true);
    }
  });

  it('lägger ingen uppmuntran på ett vanligt pass eller en annan gren', () => {
    for (const [namn, profil] of Object.entries(PROFILES)) {
      const missade = kontroller(profil).filter((check) => !check.reached);
      const grenar = new Set(missade.map((check) => check.sport));

      for (const session of medUppmuntran(profil)) {
        expect(session.type, `${namn} ${session.id}`).toBe('long');
        expect(grenar.has(session.sport as never), `${namn} ${session.id}`).toBe(true);
      }
    }
  });

  it('ändrar inte planen, bara texten', () => {
    // Motorn når aldrig ett riktmärke genom att lägga till träning. Uppmuntran
    // är ett erbjudande till användaren, inte en ändring av programmet.
    const planer = buildWeekPlans(knappTid);
    const totalt = planer.reduce((summa, plan) => summa + plan.totalMinutes, 0);
    const långpass = planer.flatMap((plan) =>
      plan.sessions.filter((session) => session.type === 'long'),
    );

    expect(medUppmuntran(knappTid).length).toBeGreaterThan(0);
    expect(totalt).toBeGreaterThan(0);

    // Inget långpass är längre än taken tillåter — uppmuntran rör inte tiden.
    for (const session of långpass) {
      if (session.sport === null) continue;
      const tak = rules.longSession.capMinutesBySport[session.sport as 'bike'];
      expect(session.minutes, session.id).toBeLessThanOrEqual(tak);
    }
  });
});
