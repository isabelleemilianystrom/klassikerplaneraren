import { describe, expect, it } from 'vitest';
import type { RaceDates } from '../types';
import { buildBlocks, groupRacesIntoBlocks } from './blocks';
import { buildTimeline } from './timeline';

const today = '2026-10-13';

/** Cykel och simning ligger två veckor isär och hör ihop. */
const races: RaceDates = {
  skiing: '2027-03-07',
  cycling: '2027-06-18',
  swimming: '2027-07-03',
  running: '2027-09-25',
};

/** Alla fyra loppen långt isär. */
const spread: RaceDates = {
  skiing: '2027-03-07',
  cycling: '2027-05-15',
  swimming: '2027-07-25',
  running: '2027-09-25',
};

describe('groupRacesIntoBlocks', () => {
  it('slår ihop lopp som ligger nära varandra', () => {
    expect(groupRacesIntoBlocks(races)).toEqual([
      ['skiing'],
      ['cycling', 'swimming'],
      ['running'],
    ]);
  });

  it('ger varje lopp ett eget block när de ligger isär', () => {
    expect(groupRacesIntoBlocks(spread)).toEqual([
      ['skiing'],
      ['cycling'],
      ['swimming'],
      ['running'],
    ]);
  });

  it('sorterar efter datum, inte efter ordningen i objektet', () => {
    const shuffled: RaceDates = {
      running: '2027-09-25',
      skiing: '2027-03-07',
      swimming: '2027-07-25',
      cycling: '2027-05-15',
    };
    expect(groupRacesIntoBlocks(shuffled)[0]).toEqual(['skiing']);
  });
});

describe('buildBlocks', () => {
  const timeline = buildTimeline(races, today);
  const { blocks, blockOfWeek } = buildBlocks(timeline, races);

  it('ger ett block per grupp', () => {
    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.focus)).toEqual([
      ['skiing'],
      ['cycling', 'swimming'],
      ['running'],
    ]);
  });

  it('placerar varje vecka i exakt ett block', () => {
    expect(blockOfWeek).toHaveLength(timeline.length);
    for (const index of blockOfWeek) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(blocks.length);
    }
  });

  it('lägger blocken i ordning utan hopp', () => {
    for (let i = 1; i < blockOfWeek.length; i += 1) {
      const previous = blockOfWeek[i - 1] as number;
      const current = blockOfWeek[i] as number;
      expect(current - previous).toBeGreaterThanOrEqual(0);
      expect(current - previous).toBeLessThanOrEqual(1);
    }
  });

  it('täcker hela tidslinjen utan luckor', () => {
    expect(blocks[0]?.startDate).toBe(timeline[0]);
    expect(blocks.at(-1)?.endDate).toBe(timeline.at(-1));
  });

  it('låter sista blocket äga återhämtningsveckan efter sista loppet', () => {
    expect(blockOfWeek.at(-1)).toBe(blocks.length - 1);
  });
});
