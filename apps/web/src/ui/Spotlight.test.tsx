import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spotlight } from './Spotlight.tsx';

/**
 * jsdom measures every element as zero, so the cutout branch — a target that
 * resolves to a sized element — cannot be exercised here. The manual play-through
 * in Task 7 is what walks that branch.
 */
describe('Spotlight', () => {
  it('dims the whole screen when it points at nothing', () => {
    render(<Spotlight />);
    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--soft');
  });

  it('dims the whole screen when its target is not on screen', () => {
    render(<Spotlight target=".nothing-here" />);
    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--whole');
  });

  it('never intercepts a click', () => {
    render(<Spotlight />);
    expect(getComputedStyle(screen.getByTestId('spotlight')).pointerEvents).toBe('none');
  });

  it('is hidden from assistive tech', () => {
    render(<Spotlight />);
    expect(screen.getByTestId('spotlight')).toHaveAttribute('aria-hidden', 'true');
  });
});

/**
 * Walks up from the working directory rather than reading `import.meta.url`, which
 * under jsdom is an http URL and cannot be turned into a path. Mirrors `tokens.test.ts`.
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

const spotlightCss = readFileSync(
  locate(join('apps', 'web', 'src', 'ui', 'Spotlight.css')),
  'utf8',
);
const appCss = readFileSync(locate(join('apps', 'web', 'src', 'App.css')), 'utf8');

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The declaration body of a single CSS rule, found by its selector text. */
function rule(source: string, selector: string): string {
  const pattern = new RegExp(`${escapeForPattern(selector)}\\s*\\{([^}]*)\\}`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`No rule found for selector "${selector}"`);
  return match[1] ?? '';
}

/** The z-index declared by a single CSS rule, found by its selector text. */
function zIndex(source: string, selector: string): number {
  const declaration = /z-index:\s*(-?\d+)/.exec(rule(source, selector));
  if (!declaration) throw new Error(`No z-index declared for selector "${selector}"`);
  return Number(declaration[1]);
}

describe('the stylesheet contract', () => {
  it('keeps the ring under reduced motion', () => {
    expect(rule(spotlightCss, '.spotlight__ring')).toMatch(
      /border:\s*1px solid var\(--accent-line\)/,
    );
  });

  it('drops only the pulse under reduced motion', () => {
    expect(rule(spotlightCss, '.spotlight__ring')).not.toMatch(/animation/);
    expect(rule(spotlightCss, ".spotlight[data-motion='full'] .spotlight__ring")).toMatch(
      /animation/,
    );
  });

  it('never spends the accent on the dim', () => {
    expect(spotlightCss).not.toMatch(/--accent(?!-)/);
  });

  it('sits beneath the prompt bar', () => {
    expect(zIndex(spotlightCss, '.spotlight')).toBeLessThan(zIndex(appCss, '.shell__prompt'));
  });
});
