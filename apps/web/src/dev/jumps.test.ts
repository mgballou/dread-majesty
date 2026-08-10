import { describe, expect, it } from 'vitest';
import { CURRENT, TIER_IDS } from '@dm/content';
import { nextCost } from '@dm/engine';
import { jumps } from './jumps.ts';

const list = jumps(CURRENT);

function find(id: string) {
  const jump = list.find((candidate) => candidate.id === id);
  if (!jump) throw new Error(`No jump called ${id}`);
  return jump;
}

describe('jumps', () => {
  it('offers true zero first', () => {
    expect(list[0]?.id).toBe('zero');
  });

  it('starts true zero with nothing banked', () => {
    expect(find('zero').build().resources.evil.eq(0)).toBe(true);
  });

  it('offers a jump for every tier', () => {
    const covered = TIER_IDS.filter((id) => list.some((jump) => jump.id === `afford:${id}`));
    expect(covered).toHaveLength(TIER_IDS.length);
  });

  it('banks exactly what the first of a tier costs', () => {
    const warren = CURRENT.tiers.find((tier) => tier.id === 'warren');
    expect(find('afford:warren').build().resources.evil.toString()).toBe(warren?.baseCost);
  });

  it('banks exactly what an Overseer costs', () => {
    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion');
    const post = minion?.overseers[0];
    expect(find(`appoint:${post?.id}`).build().resources.evil.toString()).toBe(post?.cost);
  });

  it('leaves the tier being appointed unappointed', () => {
    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion');
    const post = minion?.overseers[0];
    expect(find(`appoint:${post?.id}`).build().overseers.minion).toEqual([]);
  });

  it('puts a tier on its first milestone', () => {
    const first = CURRENT.milestones[0]?.at ?? 0;
    expect(find('milestone:warren').build().gens.warren.owned.eq(first)).toBe(true);
  });

  it('marks a held tier as met', () => {
    expect(find('milestone:warren').build().unlocked.warren).toBe(true);
  });

  it('owes a soul at the threshold the prestige formula names', () => {
    const state = find('owed:1').build();
    const { k, scale, exponent } = CURRENT.prestige;
    expect(state.lifetimeEvil.div(scale).pow(exponent).sub(1).mul(k).floor().toNumber()).toBe(1);
  });

  it('banks souls without banking Evil', () => {
    expect(find('banked:600').build().souls.eq(600)).toBe(true);
  });

  it('appoints everybody on the deep run', () => {
    const state = find('deep').build();
    expect(TIER_IDS.every((id) => state.overseers[id].length > 0)).toBe(true);
  });

  it('names every jump', () => {
    expect(list.every((jump) => jump.label.length > 0)).toBe(true);
  });

  it('groups every jump', () => {
    expect(list.every((jump) => jump.group.length > 0)).toBe(true);
  });

  it('gives every jump a distinct id', () => {
    expect(new Set(list.map((jump) => jump.id)).size).toBe(list.length);
  });

  it('leaves every jump somewhere the player can act from', () => {
    for (const jump of list) {
      const state = jump.build();
      const canDoSomething =
        state.resources.evil.gt(0) || CURRENT.tiers.some((tier) => state.gens[tier.id].owned.gt(0));

      expect({ id: jump.id, canDoSomething }).toHaveProperty('canDoSomething', true);
    }
  });

  it('keeps the free Minion on a freshly reset board', () => {
    expect(find('banked:600').build().gens.minion.owned.toString()).toBe('1');
  });

  it('resets every post on a freshly reset board', () => {
    const state = find('banked:600').build();
    expect(TIER_IDS.every((id) => state.overseers[id].length === 0)).toBe(true);
  });

  it('prices the next purchase off what the deep run actually holds', () => {
    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion');
    const state = find('deep').build();
    expect(nextCost(state, CURRENT, 'minion')?.toString()).not.toBe(minion?.baseCost);
  });

  it('can still afford to grow on the deep run', () => {
    const state = find('deep').build();
    const next = nextCost(state, CURRENT, 'throne');
    expect(next !== null && next.lte(state.resources.evil)).toBe(true);
  });

  it('appoints only the automator on a first milestone', () => {
    const warren = CURRENT.tiers.find((tier) => tier.id === 'warren');
    const automator = warren?.overseers.find((post) => post.effect.kind === 'automate');
    expect(find('milestone:warren').build().overseers.warren).toEqual([automator?.id]);
  });

  it('carries only the automator on a beneath tier reaching for the next one', () => {
    const minion = CURRENT.tiers.find((tier) => tier.id === 'minion');
    const automator = minion?.overseers.find((post) => post.effect.kind === 'automate');
    expect(find('afford:warren').build().overseers.minion).toEqual([automator?.id]);
  });
});
