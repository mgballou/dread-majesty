import { describe, expect, it } from 'vitest';
import { CURRENT, CURRENT_COPY, TIER_IDS } from '@dm/content';
import { jumps } from './jumps.ts';

const list = jumps(CURRENT, CURRENT_COPY);

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
    expect(find('appoint:minion').build().resources.evil.toString()).toBe(
      minion?.overseers[0]?.cost,
    );
  });

  it('leaves the tier being appointed unappointed', () => {
    expect(find('appoint:minion').build().overseers.minion).toEqual([]);
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
    const { k, scale } = CURRENT.prestige;
    expect(state.lifetimeEvil.div(scale).sqrt().mul(k).floor().toNumber()).toBe(1);
  });

  it('banks souls without banking Evil', () => {
    expect(find('banked:10').build().souls.eq(10)).toBe(true);
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
});
