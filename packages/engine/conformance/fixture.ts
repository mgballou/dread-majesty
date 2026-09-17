import type { Content } from '@dm/content';
import { fixture } from '../test/fixtures/content.ts';

/**
 * Lower prestige scale so the two-tier fixture chain can earn souls
 * within a reasonable simulation time. Every other field is the base
 * test fixture — no milestones, two tiers, the worked example numbers.
 */
export const conformanceFixture: Content = {
  ...fixture,
  version: 'conformance',
  prestige: { k: 150, scale: '1e4', exponent: 0.5, perSoul: 0.02 },
};
