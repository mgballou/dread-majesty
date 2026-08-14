import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/*
 * The target that starts hidden.
 *
 * A beat naming a control inside a shut deck panel lands a render before the deck opens
 * that panel, so the first measurement reads an element that is mounted with no box. The
 * window fires nothing when a tab opens, so unless the element's own box is watched the
 * dim stays on the whole screen for the rest of the beat.
 *
 * jsdom neither lays out nor observes, so both halves are stood in for: the rect is a
 * stub and the observer is driven by hand. **What this pins is the mechanism** — that the
 * component watches its target and re-measures when told the box changed, and that it
 * stops watching when it goes. It cannot say the hole lands on the right control on a
 * real screen; that is the browser pass's.
 */
class DriveableObserver implements ResizeObserver {
  readonly watched: Element[] = [];
  stopped = false;
  private readonly report: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.report = callback;
    built.push(this);
  }

  observe(element: Element): void {
    this.watched.push(element);
  }

  unobserve(): void {}

  disconnect(): void {
    this.stopped = true;
  }

  /** What the browser does when the watched box changes size. */
  fire(): void {
    this.report([], this);
  }
}

const built: DriveableObserver[] = [];

function box({ top, left }: { top: number; left: number }): DOMRect {
  const width = 200;
  const height = 50;
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe('Spotlight measures again when its target gains a box', () => {
  let hidden: HTMLElement;

  beforeEach(() => {
    built.length = 0;
    vi.stubGlobal('ResizeObserver', DriveableObserver);
    hidden = document.createElement('div');
    hidden.className = 'shut-panel-target';
    document.body.append(hidden);
  });

  afterEach(() => {
    hidden.remove();
    vi.unstubAllGlobals();
  });

  it('watches the element it points at', () => {
    render(<Spotlight target=".shut-panel-target" />);
    expect(built[0]?.watched).toContain(hidden);
  });

  it('watches nothing when it points at nothing', () => {
    render(<Spotlight />);
    expect(built).toHaveLength(0);
  });

  it('cuts the hole once the panel opens and the target is sized', () => {
    render(<Spotlight target=".shut-panel-target" />);
    hidden.getBoundingClientRect = (): DOMRect => box({ top: 300, left: 40 });
    act(() => built[0]?.fire());

    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--cutout');
  });

  it('stands the ring off the target it has just measured', () => {
    render(<Spotlight target=".shut-panel-target" />);
    hidden.getBoundingClientRect = (): DOMRect => box({ top: 300, left: 40 });
    act(() => built[0]?.fire());

    expect(document.querySelector('.spotlight__ring')).toHaveStyle({ top: '292px' });
  });

  it('stops watching when it leaves the screen', () => {
    const { unmount } = render(<Spotlight target=".shut-panel-target" />);
    unmount();

    expect(built[0]?.stopped).toBe(true);
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
const returnCss = readFileSync(
  locate(join('apps', 'web', 'src', 'screens', 'OfflineSummary.css')),
  'utf8',
);

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

  /* The third pair of the same contract, which App.css states in full: the dim must
     never fall across the words explaining it, and the return summary takes the screen
     from both. Three files, one order, and nothing may reorder them. */
  it('leaves the prompt bar beneath the return summary', () => {
    expect(zIndex(appCss, '.shell__prompt')).toBeLessThan(zIndex(returnCss, '.return'));
  });
});
