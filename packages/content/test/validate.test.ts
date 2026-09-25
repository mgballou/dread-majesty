import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT, isContent } from '../src/index.ts';

function roundTrip(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(JSON.stringify(CURRENT));
  if (typeof parsed !== 'object' || parsed === null) throw new TypeError('not an object');
  return { ...parsed };
}

describe('isContent', () => {
  it('accepts the shipping content after a trip through JSON', () => {
    expect(isContent(JSON.parse(JSON.stringify(CURRENT)))).toBe(true);
  });

  it('accepts the file the backstage publishes', () => {
    const published: unknown = JSON.parse(
      readFileSync(new URL('./fixtures/published-chain.json', import.meta.url), 'utf8'),
    );
    expect(isContent(published)).toBe(true);
  });

  it('refuses something that is not an object', () => {
    expect(isContent('[]')).toBe(false);
  });

  it('refuses a chain without a version', () => {
    expect(isContent({ ...roundTrip(), version: '' })).toBe(false);
  });

  it('accepts a chain carrying fewer tiers than the game knows', () => {
    expect(isContent({ ...roundTrip(), tiers: CURRENT.tiers.slice(0, 2) })).toBe(true);
  });

  it('refuses a chain with no tiers', () => {
    expect(isContent({ ...roundTrip(), tiers: [] })).toBe(false);
  });

  it('refuses a chain that names a tier twice', () => {
    const tiers = [...CURRENT.tiers.slice(1), CURRENT.tiers[1]];
    expect(isContent({ ...roundTrip(), tiers })).toBe(false);
  });

  it('refuses a price written as a word, which Decimal would read as zero', () => {
    const tiers = CURRENT.tiers.map((tier, index) =>
      index === 0 ? { ...tier, baseCost: 'lots' } : tier,
    );
    expect(isContent({ ...roundTrip(), tiers })).toBe(false);
  });

  it('refuses milestones out of order', () => {
    const milestones = [...CURRENT.milestones].reverse();
    expect(isContent({ ...roundTrip(), milestones })).toBe(false);
  });

  it('refuses an achievement it has no id for', () => {
    const achievements = [{ ...CURRENT.achievements[0], id: 'minion-1e9' }];
    expect(isContent({ ...roundTrip(), achievements })).toBe(false);
  });

  it('refuses a smite without every ladder', () => {
    const smite = { ...CURRENT.smite, upgrades: CURRENT.smite.upgrades.slice(1) };
    expect(isContent({ ...roundTrip(), smite })).toBe(false);
  });
});
