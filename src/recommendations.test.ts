import { describe, expect, it } from 'vitest';
import { LONG_SHARE_BY_GOAL, mostDemandingGoal, recommendedHours } from './recommendations';
import type { Discipline, Goal } from './types';

const goals = (goal: Goal): Record<Discipline, Goal> => ({
  skiing: goal,
  cycling: goal,
  swimming: goal,
  running: goal,
});

describe('mostDemandingGoal', () => {
  it('väljer det mest krävande målet av fyra', () => {
    expect(mostDemandingGoal(goals('finish'))).toBe('finish');
    expect(mostDemandingGoal({ ...goals('finish'), cycling: 'time' })).toBe('time');
    expect(mostDemandingGoal({ ...goals('finish'), running: 'improve' })).toBe('improve');
  });

  it('låter ett tidsmål väga tyngre än ett förbättringsmål', () => {
    expect(mostDemandingGoal({ ...goals('improve'), swimming: 'time' })).toBe('time');
  });
});

describe('recommendedHours', () => {
  it('ger ett rimligt riktmärke för den som vill ta sig runt en hel klassiker', () => {
    const { min, comfortable } = recommendedHours('full', goals('finish'));
    // Sex timmar i veckan ska räcka som riktmärke för att ta sig runt. Högre än
    // så och vi skäller på folk som jobbar heltid.
    expect(min).toBeLessThanOrEqual(6);
    expect(comfortable).toBeGreaterThan(min);
  });

  it('kräver mer av ett tidsmål än av att ta sig runt', () => {
    expect(recommendedHours('full', goals('time')).min).toBeGreaterThan(
      recommendedHours('full', goals('finish')).min,
    );
  });

  it('kräver mindre av en kort klassiker än av en hel', () => {
    expect(recommendedHours('short', goals('finish')).min).toBeLessThan(
      recommendedHours('full', goals('finish')).min,
    );
  });

  it('ger samma riktmärke för korta och tjej', () => {
    expect(recommendedHours('short', goals('improve'))).toEqual(
      recommendedHours('women', goals('improve')),
    );
  });

  it('ger halva timmar, inte decimaler att grubbla på', () => {
    for (const variant of ['full', 'half', 'short', 'women'] as const) {
      for (const goal of ['finish', 'improve', 'time'] as const) {
        const { min, comfortable } = recommendedHours(variant, goals(goal));
        expect(min * 2).toBe(Math.round(min * 2));
        expect(comfortable * 2).toBe(Math.round(comfortable * 2));
      }
    }
  });
});

describe('LONG_SHARE_BY_GOAL', () => {
  it('kräver kortare långpass av den som bara vill ta sig runt', () => {
    expect(LONG_SHARE_BY_GOAL['finish']).toBeLessThan(LONG_SHARE_BY_GOAL['time']);
  });

  it('håller sig inom rimliga andelar av loppet', () => {
    for (const share of Object.values(LONG_SHARE_BY_GOAL)) {
      expect(share).toBeGreaterThanOrEqual(0.3);
      expect(share).toBeLessThanOrEqual(0.7);
    }
  });
});
