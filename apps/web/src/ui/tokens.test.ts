import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Walks up from the working directory rather than reading `import.meta.url`, which
 * under jsdom is an http URL and cannot be turned into a path.
 */
function locate(relative: string): string {
  let dir = process.cwd();
  while (!existsSync(join(dir, relative))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`Could not find ${relative} above ${process.cwd()}`);
    dir = parent;
  }
  return join(dir, relative);
}

const srcDir = locate(join('apps', 'web', 'src'));
const tokensPath = join(srcDir, 'ui', 'tokens.css');
const tokens = readFileSync(tokensPath, 'utf8');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

function themeBlocks(source: string): Map<string, Set<string>> {
  const blocks = new Map<string, Set<string>>();
  const pattern = /(:root(?:\[[^\]]*\])?)\s*\{([^}]*)\}/g;

  for (const match of source.matchAll(pattern)) {
    const selector = match[1] ?? '';
    const body = match[2] ?? '';
    const names = new Set(
      [...body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)]
        .map((declaration) => declaration[1] ?? '')
        .filter((name) => !name.startsWith('--raw-')),
    );
    const existing = blocks.get(selector);
    if (existing) for (const name of names) existing.add(name);
    else blocks.set(selector, names);
  }

  return blocks;
}

/** Every `--name: value;` in the file, last declaration winning. */
function declarations(source: string): Map<string, string> {
  const found = new Map<string, string>();

  for (const match of source.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)) {
    found.set(match[1] ?? '', (match[2] ?? '').trim());
  }

  return found;
}

const declared = declarations(tokens);

/** Follows the `var()` indirection down to the primitive that actually holds a value. */
function resolve(name: string): string {
  let value = declared.get(name);
  let hops = 0;

  while (value !== undefined && value.startsWith('var(')) {
    if (++hops > 8) throw new Error(`Token ${name} does not resolve to a value`);
    const next = value.slice('var('.length, -1).trim();
    value = declared.get(next);
  }

  if (value === undefined) throw new Error(`Token ${name} is not declared`);
  return value;
}

function channels(hex: string): [number, number, number] {
  const digits = hex.replace('#', '');
  const read = (at: number): number => parseInt(digits.slice(at, at + 2), 16) / 255;
  return [read(0), read(2), read(4)];
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex);
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

/** WCAG 2.2 relative-contrast ratio, computed from the token values themselves. */
function contrast(foreground: string, background: string): number {
  const one = luminance(resolve(foreground));
  const other = luminance(resolve(background));

  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05);
}

/** Hue in degrees, so a tone can be measured against the accent rather than eyeballed. */
function hue(name: string): number {
  const [red, green, blue] = channels(resolve(name));
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  const span = high - low;

  if (span === 0) return 0;
  if (high === red) return (((green - blue) / span) * 60 + 360) % 360;
  if (high === green) return ((blue - red) / span) * 60 + 120;
  return ((red - green) / span) * 60 + 240;
}

function hueDistance(one: string, other: string): number {
  const apart = Math.abs(hue(one) - hue(other)) % 360;
  return Math.min(apart, 360 - apart);
}

describe('token contract', () => {
  it('declares the same semantic set in every theme block', () => {
    const blocks = [...themeBlocks(tokens).values()];
    const first = blocks[0];

    for (const block of blocks) {
      expect([...block].sort()).toEqual([...(first ?? new Set())].sort());
    }
  });

  it('declares at least the semantic names the interface is built on', () => {
    const declared = [...themeBlocks(tokens).values()].flatMap((block) => [...block]);

    for (const name of ['--ground', '--surface', '--line', '--ink', '--accent', '--well']) {
      expect(declared).toContain(name);
    }
  });
});

/**
 * The contrast floor, computed from the file rather than trusted to whoever picked
 * the colour. WCAG 2.2 AA is the floor (ui-sensibility §13); the reading ramp is held
 * to AAA because it carries most of the words in the game.
 */
describe('contrast', () => {
  it('reads --ink against --surface at AAA', () => {
    expect(contrast('--ink', '--surface')).toBeGreaterThanOrEqual(7);
  });

  it('reads --ink-muted against --surface at AAA', () => {
    expect(contrast('--ink-muted', '--surface')).toBeGreaterThanOrEqual(7);
  });

  it('reads --ink-dim against --surface at AA', () => {
    expect(contrast('--ink-dim', '--surface')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads --on-accent against --accent at AA', () => {
    expect(contrast('--on-accent', '--accent')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads --ink-muted against --accent-well at AA', () => {
    expect(contrast('--ink-muted', '--accent-well')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads --ink against --accent-line at AA', () => {
    expect(contrast('--ink', '--accent-line')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads --on-accent against --accent-soft at AA', () => {
    expect(contrast('--on-accent', '--accent-soft')).toBeGreaterThanOrEqual(4.5);
  });

  it('holds the reading ramp against the panel it usually sits on', () => {
    for (const name of ['--ink', '--ink-muted', '--ink-dim']) {
      expect(contrast(name, '--surface-panel')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('holds every enumerated tone at AA against --surface', () => {
    for (const name of ['--tone-positive', '--tone-danger', '--tone-resource']) {
      expect(contrast(name, '--surface')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the chain tones perceivable against --surface', () => {
    for (const name of [
      '--tone-tier-1',
      '--tone-tier-2',
      '--tone-tier-3',
      '--tone-tier-4',
      '--tone-tier-5',
    ]) {
      expect(contrast(name, '--surface')).toBeGreaterThanOrEqual(3);
    }
  });

  it('separates a swept meter fill from the well it runs over', () => {
    expect(contrast('--accent-soft', '--accent-well')).toBeGreaterThanOrEqual(3);
  });

  it('keeps a secondary control outline perceivable', () => {
    expect(contrast('--line-strong', '--surface-panel')).toBeGreaterThanOrEqual(3);
  });
});

/**
 * One colour means act. A chain tone sitting near gold would spend the accent on
 * something that is not the action, which is the failure §5 names outright.
 */
describe('nothing crowds the accent', () => {
  it('keeps every chain tone clear of gold', () => {
    for (const name of [
      '--tone-tier-1',
      '--tone-tier-2',
      '--tone-tier-3',
      '--tone-tier-4',
      '--tone-tier-5',
    ]) {
      expect(hueDistance(name, '--accent')).toBeGreaterThanOrEqual(45);
    }
  });

  it('keeps the full-strength accent brighter than its low-weight jobs', () => {
    for (const name of ['--accent-line', '--accent-soft', '--accent-well']) {
      expect(contrast('--accent', '--surface')).toBeGreaterThan(contrast(name, '--surface'));
    }
  });

  it('keeps every chain tone clear of every other chain tone', () => {
    const tones = [
      '--tone-tier-1',
      '--tone-tier-2',
      '--tone-tier-3',
      '--tone-tier-4',
      '--tone-tier-5',
    ];

    for (const one of tones) {
      for (const other of tones) {
        if (one === other) continue;
        expect(hueDistance(one, other)).toBeGreaterThanOrEqual(30);
      }
    }
  });
});

describe('no raw values outside the token definitions', () => {
  const others = cssFiles(srcDir).filter((path) => path !== tokensPath);

  it('finds stylesheets to check', () => {
    expect(others.length).toBeGreaterThan(0);
  });

  it('holds no literal colour anywhere but the token definitions', () => {
    for (const path of others) {
      expect({
        path,
        colours: [...readFileSync(path, 'utf8').matchAll(/#[0-9a-f]{3,8}\b/gi)],
      }).toHaveProperty('colours', []);
    }
  });

  it('holds no rgb or hsl literal anywhere but the token definitions', () => {
    for (const path of others) {
      expect({
        path,
        functions: [...readFileSync(path, 'utf8').matchAll(/\b(?:rgba?|hsla?)\(/g)],
      }).toHaveProperty('functions', []);
    }
  });

  it('never reaches past the semantic layer to a primitive', () => {
    for (const path of others) {
      expect({
        path,
        primitives: [...readFileSync(path, 'utf8').matchAll(/var\(--raw-/g)],
      }).toHaveProperty('primitives', []);
    }
  });
});
