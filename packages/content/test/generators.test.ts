import { describe, expect, it } from 'vitest';
import { v1 } from '../src/v1/generators.ts';
import { TIER_IDS, SMITE_UPGRADE_IDS, isSmiteUpgradeId } from '../src/ids.ts';
import type { TierId } from '../src/ids.ts';
import type { SmiteUpgradeId, SmiteUpgradeDef } from '../src/index.ts';

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

  it('prices the quicken and swell posts at twenty and two hundred times the automator', () => {
    for (const tier of v1.tiers) {
      const automate = Number(tier.overseers[0]?.cost ?? '0');
      const quicken = Number(tier.overseers[1]?.cost ?? '0');
      const swell = Number(tier.overseers[2]?.cost ?? '0');

      expect(quicken / automate).toBeCloseTo(20, 2);
      expect(swell / automate).toBeCloseTo(200, 2);
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

function ladder(id: SmiteUpgradeId): SmiteUpgradeDef {
  const found = v1.smite.upgrades.find((upgrade) => upgrade.id === id);
  if (!found) throw new Error(`no ladder ${id}`);
  return found;
}

describe('every Evil figure the content authors', () => {
  it('is a whole number, so what a tier promises reads as what it pays', () => {
    const evil: string[] = [
      ...v1.tiers.filter((tier) => tier.produces === 'evil').map((tier) => tier.yield),
      ...v1.tiers.map((tier) => tier.baseCost),
      ...v1.tiers.flatMap((tier) => tier.overseers.map((post) => post.cost)),
      ...v1.smite.upgrades.flatMap((upgrade) => upgrade.rungs.map((rung) => rung.evil)),
    ];

    for (const value of evil) {
      expect(Number(value) % 1).toBe(0);
    }
  });
});

describe('the smite ladders', () => {
  it('ships one ladder per id', () => {
    expect(v1.smite.upgrades.map((upgrade) => upgrade.id).sort()).toEqual(
      [...SMITE_UPGRADE_IDS].sort(),
    );
  });

  it('gives every ladder four rungs', () => {
    for (const upgrade of v1.smite.upgrades) {
      expect(upgrade.rungs).toHaveLength(4);
    }
  });

  it('raises Weight up its ladder', () => {
    const values = ladder('weight').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('raises Reach up its ladder', () => {
    const values = ladder('reach').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it('lowers Forgetting down its ladder', () => {
    const values = ladder('forgetting').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('lowers Restraint down its ladder', () => {
    const values = ladder('restraint').rungs.map((rung) => rung.value);

    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('starts Weight where the flat multiplier used to sit', () => {
    expect(ladder('weight').base).toBe(2);
  });

  it('starts Reach where the flat duration used to sit', () => {
    expect(ladder('reach').base).toBe(15_000);
  });

  it('raises the Evil price at every rung of every ladder', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => Number(rung.evil));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it('spans a run with each ladder, at two hundred times a rung', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => Number(rung.evil));

      for (let index = 1; index < prices.length; index += 1) {
        expect(prices[index]! / prices[index - 1]!).toBeCloseTo(200, 2);
      }
    }
  });

  it('opens the shop on Reach, the cheapest first rung', () => {
    const firsts = v1.smite.upgrades.map((upgrade) => Number(upgrade.rungs[0]?.evil ?? '0'));
    const reach = Number(
      v1.smite.upgrades.find((upgrade) => upgrade.id === 'reach')?.rungs[0]?.evil ?? '0',
    );

    expect(reach).toBe(Math.min(...firsts));
  });

  it('raises the soul price at every rung of every ladder', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => Number(rung.souls));
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    }
  });

  it('never lets the cooldown fall under the shortest blow', () => {
    expect(v1.smite.cooldownMs).toBeGreaterThanOrEqual(ladder('reach').base);
  });

  it('makes re-climbing dearer every run, so keeping a rung can be worth souls', () => {
    expect(v1.smite.climbGrowth).toBeGreaterThan(1);
  });

  it('keeps the cooldown inside the regime the ranking assumes', () => {
    const forgetting = ladder('forgetting');
    const values = [forgetting.base, ...forgetting.rungs.map((rung) => rung.value)];

    for (const value of values) {
      expect(v1.smite.cooldownMs / value).toBeLessThanOrEqual(v1.smite.apathy.perBlow);
    }
  });
});

describe('the soul price of permanence', () => {
  it('prices every ladder the same by rung', () => {
    for (const upgrade of v1.smite.upgrades) {
      const prices = upgrade.rungs.map((rung) => Number(rung.souls));

      expect(prices).toEqual([220, 660, 1100, 1760]);
    }
  });

  it('keeps a full ladder inside what a long run pays', () => {
    const ladderCost = v1.smite.upgrades[0]!.rungs.reduce(
      (total, rung) => total + Number(rung.souls),
      0,
    );
    const twelveHourRun = 600 * Math.pow(2.1e25 / Number(v1.prestige.scale), v1.prestige.exponent);

    expect(ladderCost).toBeLessThan(twelveHourRun);
  });
});

describe('the prestige curve', () => {
  it('holds the product that fixes the plateau', () => {
    expect(v1.prestige.k * v1.prestige.perSoul).toBeCloseTo(0.6, 6);
  });

  it('keeps the exponent under the threshold the economy allows', () => {
    // Spec §2.1: stability needs a·q·p < 1, where `q` is the exponent on lifetime Evil
    // and `p` is the exponent on souls in the favour formula. Favour is linear in
    // souls, so p is 1 and drops out. Measured `a` peaks at 18.4, so this is the whole
    // of the condition — `k` and `perSoul` do not belong in it.
    expect(v1.prestige.exponent * 18.4).toBeLessThan(1.05);
  });

  it('anchors the scale on the lifetime Evil that first paid a soul', () => {
    const { k, scale, exponent } = v1.prestige;
    // 5.147e9 is the measured lifetime Evil at 41m 51s.
    const souls = k * Math.pow(5.147e9 / Number(scale), exponent);

    expect(Math.round(souls)).toBe(600);
  });

  it('spans a run rather than a lifetime', () => {
    const { k, scale, exponent } = v1.prestige;
    // 2.394e15 and 2.1e25 are measured lifetime Evil at three and twelve hours.
    const atThreeHours = k * Math.pow(2.394e15 / Number(scale), exponent);
    const atTwelveHours = k * Math.pow(2.1e25 / Number(scale), exponent);

    expect(Math.round(atThreeHours)).toBe(1231);
    expect(Math.round(atTwelveHours)).toBe(4336);
  });
});

describe('the smite upgrade ids', () => {
  it('names four ladders', () => {
    expect(SMITE_UPGRADE_IDS).toHaveLength(4);
  });

  it('repeats none of them', () => {
    expect(new Set(SMITE_UPGRADE_IDS).size).toBe(SMITE_UPGRADE_IDS.length);
  });

  it('accepts an id it ships', () => {
    expect(isSmiteUpgradeId('weight')).toBe(true);
  });

  it('rejects an id it does not', () => {
    expect(isSmiteUpgradeId('patience')).toBe(false);
  });
});
