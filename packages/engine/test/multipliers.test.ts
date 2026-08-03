import Decimal from 'break_eternity.js';
import { describe, expect, it } from 'vitest';
import { BASE_DT_MS, createState, milestoneProgress, step } from '../src/index.ts';
import { fixture, fixtureWithMilestones } from './fixtures/content.ts';

function seeded(minions: number, content = fixtureWithMilestones) {
  const state = createState(content);
  state.gens.minion.owned = new Decimal(minions);
  state.gens.slum.owned = new Decimal(0);
  return state;
}

function runOneCycle(state: ReturnType<typeof createState>, content = fixtureWithMilestones) {
  for (let elapsed = 0; elapsed < 24_000; elapsed += BASE_DT_MS) step(state, content, BASE_DT_MS);
}

describe('milestone multipliers', () => {
  it('doubles output once per threshold passed', () => {
    const below = seeded(24);
    const above = seeded(25);

    runOneCycle(below);
    runOneCycle(above);

    expect(below.resources.evil.toString()).toBe('360'); // 24 * 15
    expect(above.resources.evil.toString()).toBe('750'); // 25 * 15 * 2
  });

  it('stacks every threshold reached', () => {
    const state = seeded(100);

    runOneCycle(state);

    // 100 * 15 * 2 * 2 * 2
    expect(state.resources.evil.toString()).toBe('12000');
  });

  it('does not apply when content declares no milestones', () => {
    const state = seeded(100, fixture);

    runOneCycle(state, fixture);

    expect(state.resources.evil.toString()).toBe('1500');
  });
});

describe('milestoneProgress', () => {
  it('names the next threshold and the distance to it', () => {
    const state = seeded(13);

    const progress = milestoneProgress(state, fixtureWithMilestones, 'minion');

    expect(progress.next).toBe(25);
    expect(progress.remaining?.toString()).toBe('12');
  });

  it('reports no next threshold once every one is passed', () => {
    const state = seeded(500);

    const progress = milestoneProgress(state, fixtureWithMilestones, 'minion');

    expect(progress.next).toBe(null);
    expect(progress.remaining).toBe(null);
  });
});

describe('soul multiplier', () => {
  it('adds its share to every tier', () => {
    const plain = seeded(10, fixture);
    const blessed = seeded(10, fixture);
    blessed.souls = new Decimal(50); // +100% at 0.02 each

    runOneCycle(plain, fixture);
    runOneCycle(blessed, fixture);

    expect(plain.resources.evil.toString()).toBe('150');
    expect(blessed.resources.evil.toString()).toBe('300');
  });
});
