import { describe, expect, it } from 'vitest';
import { DISCIPLINES, type ClassicVariant } from './types';
import {
  engelbrektsloppetMatters,
  raceDistanceKm,
  VARIANTS,
  VARIANT_DISTANCES_KM,
} from './variants';

describe('raceDistanceKm', () => {
  it('ger den hela klassikerns distanser', () => {
    expect(raceDistanceKm('full', 'skiing')).toBe(90);
    expect(raceDistanceKm('full', 'cycling')).toBe(315);
    expect(raceDistanceKm('full', 'swimming')).toBe(3);
    expect(raceDistanceKm('full', 'running')).toBe(30);
  });

  it('ger halva distanser i halva klassikern', () => {
    expect(raceDistanceKm('half', 'skiing')).toBe(45);
    expect(raceDistanceKm('half', 'cycling')).toBe(150);
    expect(raceDistanceKm('half', 'swimming')).toBe(1.5);
    expect(raceDistanceKm('half', 'running')).toBe(15);
  });

  it('ger samma distanser för korta och tjej', () => {
    for (const discipline of DISCIPLINES) {
      expect(raceDistanceKm('short', discipline)).toBe(raceDistanceKm('women', discipline));
    }
  });

  it('räknar skidloppet som 60 km när användaren åker Engelbrektsloppet', () => {
    expect(raceDistanceKm('full', 'skiing', true)).toBe(60);
  });

  it('räknar skidloppet som 90 km annars', () => {
    expect(raceDistanceKm('full', 'skiing', false)).toBe(90);
  });

  it('låter Engelbrektsloppet sakna betydelse i övriga varianter', () => {
    const others: readonly ClassicVariant[] = ['half', 'short', 'women'];
    for (const variant of others) {
      expect(raceDistanceKm(variant, 'skiing', true)).toBe(raceDistanceKm(variant, 'skiing'));
      expect(engelbrektsloppetMatters(variant)).toBe(false);
    }
    expect(engelbrektsloppetMatters('full')).toBe(true);
  });

  it('påverkar inte andra grenar än skidor', () => {
    for (const discipline of DISCIPLINES) {
      if (discipline === 'skiing') continue;
      expect(raceDistanceKm('full', discipline, true)).toBe(raceDistanceKm('full', discipline));
    }
  });
});

describe('VARIANT_DISTANCES_KM', () => {
  it('har en positiv distans för varje gren i varje variant', () => {
    for (const variant of VARIANTS) {
      for (const discipline of DISCIPLINES) {
        expect(VARIANT_DISTANCES_KM[variant][discipline]).toBeGreaterThan(0);
      }
    }
  });

  it('har kortare eller lika distanser ju kortare varianten är', () => {
    for (const discipline of DISCIPLINES) {
      const full = raceDistanceKm('full', discipline);
      const half = raceDistanceKm('half', discipline);
      const short = raceDistanceKm('short', discipline);
      expect(half).toBeLessThan(full);
      expect(short).toBeLessThan(half);
    }
  });
});
