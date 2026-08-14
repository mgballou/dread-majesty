import { describe, expect, it } from 'vitest';
import { DOMINION_BEAT_IDS, MALICE_BEAT_IDS, v1, v1Copy, v1Onboarding } from '../src/index.ts';
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

  it("answers her in the narrator's voice", () => {
    expect(v1Onboarding.malice.find((beat) => beat.id === 'verdict')?.voice).toBe('narrator');
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

  it('gates a beat that clears by a gated action', () => {
    for (const beat of beats.filter((candidate) => candidate.clearedBy === 'gated-action')) {
      expect(beat.gate.kind).not.toBe('none');
    }
  });
});

describe('the onboarding copy', () => {
  const copy = v1Copy.onboarding;

  it('gives every Dominion beat a line', () => {
    for (const id of DOMINION_BEAT_IDS) expect(copy.dominion[id].length).toBeGreaterThan(0);
  });

  it('orders the waiting lines by descending threshold', () => {
    const thresholds = copy.waiting.map((entry) => entry.aboveApathy);
    expect(thresholds).toEqual([...thresholds].sort((one, other) => other - one));
  });

  it('ends the waiting list on a threshold that always matches', () => {
    expect(copy.waiting.at(-1)?.aboveApathy).toBeLessThan(0);
  });

  it('gives every waiting entry a line', () => {
    for (const entry of copy.waiting) expect(entry.line.length).toBeGreaterThan(0);
  });

  it('gives her a line for every blow that can land while she is on screen', () => {
    expect(copy.urging.length).toBeGreaterThanOrEqual(2);
  });

  it('gives the narrator an answer for each way her turn ends', () => {
    expect([copy.malice.verdict.caved, copy.malice.verdict.resisted].every((l) => l.length > 0)).toBe(true);
  });

  it('does not promise the cascade a count it cannot keep', () => {
    expect(copy.dominion.cascade).not.toContain('Five');
  });

  it('offers both bail actions on the opening beat', () => {
    expect([copy.skip, copy.loadSave].every((label) => label.length > 0)).toBe(true);
  });

  it('plants her in the opening line', () => {
    expect(copy.dominion.stir).toContain('otherworldly abomination');
  });
});

describe('the Malice track resolves', () => {
  const malice = v1Onboarding.malice;
  const beat = (id: string) => malice.find((candidate) => candidate.id === id);

  it('keeps her talking until the player has caved twice', () => {
    expect(beat('goad')?.clearedBy).toEqual({
      kind: 'superseded',
      when: { kind: 'smites-at-least', count: 3 },
    });
  });

  it('lets the verdict land however her turn ended', () => {
    expect(beat('verdict')?.ready).toEqual({ kind: 'always' });
  });

  it('never expires the verdict', () => {
    expect(beat('verdict')?.retireAfterMs).toBeNull();
  });

  it('never expires the opening explanation', () => {
    expect(beat('first-blow')?.retireAfterMs).toBeNull();
  });

  it('leaves her the one beat that gives up on its own', () => {
    const timed = malice.filter((candidate) => candidate.retireAfterMs !== null);
    expect(timed.map((candidate) => candidate.id)).toEqual(['goad']);
  });

  it('brings her on with the blow rather than with the next one', () => {
    expect(beat('goad')?.ready).toEqual({ kind: 'smites-at-least', count: 1 });
  });

  it('gives every superseded beat a successor to hand over to', () => {
    for (const track of [v1Onboarding.dominion, v1Onboarding.malice]) {
      expect(typeof track.at(-1)?.clearedBy).toBe('string');
    }
  });

  it('points her at the strike rather than at her own gate', () => {
    expect(beat('goad')?.points).toEqual({ kind: 'smite' });
  });
});
