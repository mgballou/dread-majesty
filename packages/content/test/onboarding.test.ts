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
    expect(v1Onboarding.malice.find((beat) => beat.id === 'apathy')?.voice).toBe('narrator');
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

  it('orders the goad lines by descending threshold', () => {
    const thresholds = copy.goad.map((entry) => entry.aboveApathy);
    expect(thresholds).toEqual([...thresholds].sort((one, other) => other - one));
  });

  it('ends the goad list on a threshold that always matches', () => {
    expect(copy.goad.at(-1)?.aboveApathy).toBeLessThan(0);
  });

  it('gives every goad entry a line', () => {
    for (const entry of copy.goad) expect(entry.line.length).toBeGreaterThan(0);
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

  it('keeps her talking across strikes', () => {
    expect(beat('goad')?.clearedBy).toBe('next-ready');
  });

  it('lets the narrator answer her rather than a timer', () => {
    expect(beat('apathy')?.retireAfterMs).toBeNull();
  });

  it('never expires the opening explanation', () => {
    expect(beat('first-blow')?.retireAfterMs).toBeNull();
  });

  it('leaves her the one beat that gives up on its own', () => {
    const timed = malice.filter((candidate) => candidate.retireAfterMs !== null);
    expect(timed.map((candidate) => candidate.id)).toEqual(['goad']);
  });

  it('gives every beat that clears on the next one a successor to wait for', () => {
    for (const track of [v1Onboarding.dominion, v1Onboarding.malice]) {
      const last = track.at(-1);
      expect(last?.clearedBy).not.toBe('next-ready');
    }
  });
});
