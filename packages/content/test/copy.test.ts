import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_IDS, OVERSEER_IDS, TIER_IDS } from '../src/ids.ts';
import type { OverseerId } from '../src/ids.ts';
import type { OverseerDef } from '../src/types.ts';
import { v1Achievements } from '../src/v1/achievements.ts';
import { v1Copy } from '../src/v1/copy.ts';
import { v1 } from '../src/v1/generators.ts';

function findPost(id: OverseerId): OverseerDef {
  const post = v1.tiers.flatMap((tier) => tier.overseers).find((candidate) => candidate.id === id);
  if (!post) throw new Error(`No post named ${id} in v1`);
  return post;
}

function effectLine(post: OverseerDef): string {
  switch (post.effect.kind) {
    case 'automate':
      return v1Copy.overseer.effect.automate;
    case 'quicken':
      return v1Copy.overseer.effect.quicken(String(post.effect.factor));
    case 'swell':
      return v1Copy.overseer.effect.swell(String(post.effect.factor));
  }
}

function textIn(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    return items.flatMap(textIn);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(textIn);
  }
  return [];
}

describe.each(ACHIEVEMENT_IDS)('achievement %s', (id) => {
  it('has a name', () => {
    expect(v1Copy.achievements[id].name.length).toBeGreaterThan(0);
  });

  it('has a description', () => {
    expect(v1Copy.achievements[id].description.length).toBeGreaterThan(0);
  });

  it('ships in the achievement list', () => {
    expect(v1Achievements.map((achievement) => achievement.id)).toContain(id);
  });
});

describe.each(TIER_IDS)('tier %s', (id) => {
  it('has a line of flavour', () => {
    expect(v1Copy.tiers[id].flavour.length).toBeGreaterThan(0);
  });
});

describe.each(OVERSEER_IDS)('overseer %s', (id) => {
  it('has a name', () => {
    expect(v1Copy.overseer.names[id].length).toBeGreaterThan(0);
  });

  it('has a note', () => {
    expect(v1Copy.overseer.notes[id].length).toBeGreaterThan(0);
  });

  it('states its effect', () => {
    expect(effectLine(findPost(id)).length).toBeGreaterThan(0);
  });
});

describe('the Overseers', () => {
  it('gives every one of them a different title', () => {
    const names = OVERSEER_IDS.map((id) => v1Copy.overseer.names[id]);
    expect(new Set(names).size).toBe(OVERSEER_IDS.length);
  });

  it('gives every one of them a different note', () => {
    const notes = OVERSEER_IDS.map((id) => v1Copy.overseer.notes[id]);
    expect(new Set(notes).size).toBe(OVERSEER_IDS.length);
  });

  it('keeps the titles the spec fixed', () => {
    expect(v1Copy.overseer.names['minion-hand']).toBe('Taskmaster of the Pits');
    expect(v1Copy.overseer.names['warren-hand']).toBe('Warden of the Warrens');
    expect(v1Copy.overseer.names['legion-hand']).toBe('Quartermaster of the Host');
    expect(v1Copy.overseer.names['fortress-hand']).toBe('Castellan of the Black Keep');
    expect(v1Copy.overseer.names['throne-hand']).toBe('Steward of the High Seat');
  });

  it('says different things about an overseen tier and a manual one', () => {
    expect(v1Copy.overseer.manual).not.toBe(v1Copy.overseer.automatic);
  });
});

describe('the achievement list', () => {
  it('carries the copy for every entry', () => {
    const missing = v1Achievements.filter(
      (achievement) => achievement.name !== v1Copy.achievements[achievement.id].name,
    );
    expect(missing).toHaveLength(0);
  });

  it('gives every achievement a different name', () => {
    const names = ACHIEVEMENT_IDS.map((id) => v1Copy.achievements[id].name);
    expect(new Set(names).size).toBe(ACHIEVEMENT_IDS.length);
  });

  it('gives every achievement a different description', () => {
    const lines = ACHIEVEMENT_IDS.map((id) => v1Copy.achievements[id].description);
    expect(new Set(lines).size).toBe(ACHIEVEMENT_IDS.length);
  });
});

describe('every string', () => {
  it('says something', () => {
    expect(textIn(v1Copy).filter((line) => line.trim().length === 0)).toHaveLength(0);
  });

  it('carries no stray whitespace', () => {
    expect(textIn(v1Copy).filter((line) => line !== line.trim())).toHaveLength(0);
  });
});

describe('the smite rotation', () => {
  it('has results to rotate through', () => {
    expect(v1Copy.smite.results.length).toBeGreaterThan(1);
  });
});

describe('the lines that take a number', () => {
  it('substitutes into the milestone line', () => {
    const line = v1Copy.milestone.next({
      remaining: '37',
      plural: 'Minions',
      multiplier: '×2',
      threshold: '50',
    });
    expect(line).toContain('37');
    expect(line).toContain('Minions');
    expect(line).toContain('×2');
    expect(line).toContain('50');
  });

  it('substitutes into the prestige lines', () => {
    expect(v1Copy.prestige.worth('+2%')).toContain('+2%');
    expect(v1Copy.prestige.nextAt('22B')).toContain('22B');
    expect(v1Copy.prestige.confirmBody('14')).toContain('14');
    expect(v1Copy.prestige.claimed('14')).toContain('14');
    expect(v1Copy.prestige.claim('670')).toContain('670');
    expect(v1Copy.prestige.favour('2%')).toContain('2%');
  });

  it('substitutes into the offline lines', () => {
    expect(v1Copy.offline.summary('2h 11m')).toContain('2h 11m');
    expect(v1Copy.offline.capped('4h')).toContain('4h');
  });

  it('substitutes into the rail and deeds lines', () => {
    expect(v1Copy.rail.cost('1.2M')).toContain('1.2M');
    expect(v1Copy.deeds.progress('7', '25')).toContain('7');
    expect(v1Copy.deeds.progress('7', '25')).toContain('25');
  });

  it('substitutes into the rest of the rail lines', () => {
    expect(v1Copy.rail.held('12')).toContain('12');
    expect(v1Copy.rail.cycle('Minion')).toContain('Minion');
    expect(v1Copy.rail.shortfall('2.4K')).toContain('2.4K');
    expect(v1Copy.rail.quantityOption('10')).toContain('10');
  });

  it('substitutes into the buy line', () => {
    const line = v1Copy.rail.buy({ count: '10', tier: 'Minions', cost: '1.2M Evil' });
    expect(line).toContain('10');
    expect(line).toContain('Minions');
    expect(line).toContain('1.2M Evil');
  });

  it('substitutes into the overseer lines', () => {
    expect(v1Copy.overseer.rouse('Minions')).toContain('Minions');
    expect(v1Copy.overseer.running('Minions')).toContain('Minions');
    expect(v1Copy.overseer.appoint('Warden of the Warrens')).toContain('Warden of the Warrens');
    expect(v1Copy.overseer.appointed('Warden of the Warrens')).toContain('Warden of the Warrens');
    expect(v1Copy.overseer.cost('800K')).toContain('800K');
  });

  it('substitutes into the upcoming row', () => {
    const line = v1Copy.rail.upcoming({ tier: 'Warrens', cost: '2.5K Evil' });
    expect(line).toContain('Warrens');
    expect(line).toContain('2.5K Evil');
  });

  it('substitutes into the stage ring', () => {
    const line = v1Copy.stage.cycle({ label: 'Minions', swept: '50%' });
    expect(line).toContain('Minions');
    expect(line).toContain('50%');
  });
});

describe('every line that takes a number', () => {
  const filled = [
    v1Copy.milestone.next({
      remaining: '37',
      plural: 'Minions',
      multiplier: '×2',
      threshold: '50',
    }),
    v1Copy.prestige.worth('+2%'),
    v1Copy.prestige.nextAt('22B'),
    v1Copy.prestige.confirmBody('14'),
    v1Copy.prestige.claimed('14'),
    v1Copy.prestige.claim('670'),
    v1Copy.prestige.favour('2%'),
    v1Copy.offline.summary('2h 11m'),
    v1Copy.offline.capped('4h'),
    v1Copy.rail.cost('1.2M'),
    v1Copy.rail.held('12'),
    v1Copy.rail.cycle('Minion'),
    v1Copy.rail.buy({ count: '10', tier: 'Minions', cost: '1.2M Evil' }),
    v1Copy.rail.shortfall('2.4K'),
    v1Copy.rail.quantityOption('10'),
    v1Copy.rail.upcoming({ tier: 'Warrens', cost: '2.5K Evil' }),
    v1Copy.overseer.rouse('Minions'),
    v1Copy.overseer.running('Minions'),
    v1Copy.overseer.appoint('Warden of the Warrens'),
    v1Copy.overseer.appointed('Warden of the Warrens'),
    v1Copy.overseer.cost('800K'),
    v1Copy.deeds.progress('7', '25'),
    v1Copy.stage.cycle({ label: 'Minions', swept: '50%' }),
  ];

  it('says something once it is filled in', () => {
    expect(filled.filter((line) => line.trim().length === 0)).toHaveLength(0);
  });

  it('carries no stray whitespace once it is filled in', () => {
    expect(filled.filter((line) => line !== line.trim())).toHaveLength(0);
  });
});

describe('the reset copy', () => {
  it('names what a claim clears', () => {
    expect(v1Copy.prestige.clears).toContain('Evil');
  });

  it('names what a claim keeps', () => {
    expect(v1Copy.prestige.keeps).toContain('souls');
  });

  it('names both in the confirmation', () => {
    expect(v1Copy.prestige.confirmBody('14')).toContain('stay');
  });
});
