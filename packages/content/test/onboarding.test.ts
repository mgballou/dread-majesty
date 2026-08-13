import { describe, expect, it } from 'vitest';
import { DOMINION_BEAT_IDS, MALICE_BEAT_IDS, v1, v1Onboarding } from '../src/index.ts';
import type { BeatGate, BeatReady } from '../src/index.ts';

const tierIds = v1.tiers.map((tier) => tier.id);
const overseerIds = v1.tiers.flatMap((tier) => tier.overseers.map((post) => post.id));

function readyIds(ready: BeatReady): readonly string[] {
  if ('tierId' in ready) return [ready.tierId];
  if ('overseerId' in ready) return [ready.overseerId];
  return [];
}

function gateIds(gate: BeatGate): readonly string[] {
  if ('tierId' in gate) return [gate.tierId];
  if ('overseerId' in gate) return [gate.overseerId];
  return [];
}

describe('the Dominion track', () => {
  it('holds one beat per id, in id order', () => {
    expect(v1Onboarding.dominion.map((beat) => beat.id)).toEqual([...DOMINION_BEAT_IDS]);
  });

  it('gates every beat but the last', () => {
    const gated = v1Onboarding.dominion.filter((beat) => beat.gate.kind !== 'none');
    expect(gated).toHaveLength(DOMINION_BEAT_IDS.length - 1);
  });

  it('leaves the last beat ungated', () => {
    expect(v1Onboarding.dominion.at(-1)?.gate.kind).toBe('none');
  });

  it('is spoken entirely by the narrator', () => {
    for (const beat of v1Onboarding.dominion) expect(beat.voice).toBe('narrator');
  });
});

describe('the Malice track', () => {
  it('holds one beat per id, in id order', () => {
    expect(v1Onboarding.malice.map((beat) => beat.id)).toEqual([...MALICE_BEAT_IDS]);
  });

  it('never gates', () => {
    for (const beat of v1Onboarding.malice) expect(beat.gate.kind).toBe('none');
  });

  it('gives the middle beat to her', () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'goad')?.voice).toBe('her');
  });

  it('answers her in the narrator’s voice', () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'apathy')?.voice).toBe('narrator');
  });

  it('clears goad on the next blow', () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'goad')?.clearedBy).toBe('smite');
  });
});

describe('every beat names something that exists', () => {
  const beats = [...v1Onboarding.dominion, ...v1Onboarding.malice];

  it('names only real ids in its ready condition', () => {
    for (const beat of beats) {
      for (const id of readyIds(beat.ready)) {
        expect([...tierIds, ...overseerIds]).toContain(id);
      }
    }
  });

  it('names only real ids in its gate', () => {
    for (const beat of beats) {
      for (const id of gateIds(beat.gate)) {
        expect([...tierIds, ...overseerIds]).toContain(id);
      }
    }
  });

  it('clears a gated beat by its own gated action', () => {
    for (const beat of beats.filter((candidate) => candidate.gate.kind !== 'none')) {
      expect(beat.clearedBy).toBe('gated-action');
    }
  });
});
