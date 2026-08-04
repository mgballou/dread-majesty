import { describe, expect, it } from 'vitest';
import { v1 } from '../src/v1/generators.ts';
import { TIER_IDS } from '../src/ids.ts';
import type { TierId } from '../src/ids.ts';

describe('the milestone ladder', () => {
  it('is strictly ascending', () => {
    const thresholds = v1.milestones.map((milestone) => milestone.at);

    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
  });

  it('repeats no threshold', () => {
    const thresholds = v1.milestones.map((milestone) => milestone.at);

    expect(new Set(thresholds).size).toBe(thresholds.length);
  });

  it('keeps the six tuned rungs at their tuned values', () => {
    const tuned = v1.milestones.slice(0, 6);

    expect(tuned).toEqual([25, 50, 100, 200, 300, 400].map((at) => ({ at, multiplier: 2 })));
  });

  it('never stops issuing before counts stop growing', () => {
    const last = v1.milestones.at(-1);

    expect(last?.at).toBeGreaterThanOrEqual(1e20);
  });

  it('grants more than nothing at every rung', () => {
    for (const milestone of v1.milestones) {
      expect(milestone.multiplier).toBeGreaterThan(1);
    }
  });
});

describe('the tiers', () => {
  it('names every tier in the id vocabulary', () => {
    expect(v1.tiers.map((tier) => tier.id).sort()).toEqual([...TIER_IDS].sort());
  });

  it('runs every cycle in whole seconds, which the harness depends on', () => {
    for (const tier of v1.tiers) {
      expect(tier.cycleMs % 1000).toBe(0);
    }
  });

  it('grows every cost curve', () => {
    for (const tier of v1.tiers) {
      expect(tier.costRate).toBeGreaterThan(1);
    }
  });

  it('prices every Overseer', () => {
    for (const tier of v1.tiers) {
      expect(Number(tier.overseers[0]?.cost)).toBeGreaterThan(0);
    }
  });

  it('prices each Overseer near four tenths of the next tier up', () => {
    const byId = new Map(v1.tiers.map((tier) => [tier.id, tier]));
    const above: Readonly<Partial<Record<TierId, TierId>>> = {
      minion: 'warren',
      warren: 'legion',
      legion: 'fortress',
      fortress: 'throne',
    };

    for (const [below, next] of Object.entries(above)) {
      const cost = Number(byId.get(below as TierId)?.overseers[0]?.cost ?? '0');
      const base = Number(byId.get(next)?.baseCost ?? '0');
      expect(cost / base).toBeCloseTo(0.4, 2);
    }
  });

  it('prices the quicken and swell posts at four and sixteen times the automator', () => {
    for (const tier of v1.tiers) {
      const automate = Number(tier.overseers[0]?.cost ?? '0');
      const quicken = Number(tier.overseers[1]?.cost ?? '0');
      const swell = Number(tier.overseers[2]?.cost ?? '0');

      expect(quicken / automate).toBeCloseTo(4, 2);
      expect(swell / automate).toBeCloseTo(16, 2);
    }
  });

  it('gives every tier an art slot', () => {
    for (const tier of v1.tiers) {
      expect(tier.art.length).toBeGreaterThan(0);
    }
  });

  it('runs the chain from Thrones down to Evil', () => {
    const order = v1.tiers.map((tier) => tier.id);

    expect(order).toEqual(['throne', 'fortress', 'legion', 'warren', 'minion']);
  });

  it('has Thrones produce Fortresses', () => {
    expect(v1.tiers.find((tier) => tier.id === 'throne')?.produces).toBe('fortress');
  });

  it('gives every tier three posts', () => {
    for (const tier of v1.tiers) {
      expect(tier.overseers).toHaveLength(3);
    }
  });

  it('leads every roster with the post that automates', () => {
    for (const tier of v1.tiers) {
      expect(tier.overseers[0]?.effect.kind).toBe('automate');
    }
  });

  it('keeps every quickened cycle a whole number of seconds', () => {
    for (const tier of v1.tiers) {
      const factor = tier.overseers
        .filter((post) => post.effect.kind === 'quicken')
        .reduce(
          (total, post) => total * (post.effect.kind === 'quicken' ? post.effect.factor : 1),
          1,
        );

      expect((tier.cycleMs / factor) % 1000).toBe(0);
    }
  });

  it('names every post exactly once across the whole chain', () => {
    const ids = v1.tiers.flatMap((tier) => tier.overseers.map((post) => post.id));

    expect(new Set(ids).size).toBe(ids.length);
  });
});
