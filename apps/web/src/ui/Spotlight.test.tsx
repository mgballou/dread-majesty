import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../../test/setup.ts';
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

/*
 * Bringing that target into view.
 *
 * The same one-render lag, one step further on: at the moment the selector changes the
 * target is `display: none`, so scrolling to it then does nothing and the hole is cut
 * wherever the player was already standing. A hole below the fold is invisible.
 *
 * jsdom implements no scrolling at all, so the method is stubbed on the one element under
 * test rather than shimmed onto every element in `test/setup.ts`. `App` reveals the
 * prestige panel through the same optional `scrollIntoView?.()` and says in as many words
 * that the optional call is there so the real branch runs wherever the method exists — a
 * global shim would quietly take that branch away from it.
 *
 * **What this pins is the mechanism:** that the scroll waits for a measured frame, that it
 * happens once per target however often the box is re-measured, and that it carries the
 * motion setting. It assumes the browser's own `scrollIntoView` does what it says.
 */
describe('Spotlight brings a target that was hidden into view', () => {
  let hidden: HTMLElement;
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    built.length = 0;
    vi.stubGlobal('ResizeObserver', DriveableObserver);
    scrollTo = vi.fn();
    hidden = document.createElement('div');
    hidden.className = 'shut-panel-target';
    hidden.scrollIntoView = scrollTo;
    document.body.append(hidden);
  });

  afterEach(() => {
    hidden.remove();
    vi.unstubAllGlobals();
  });

  function sizeAndFire(): void {
    hidden.getBoundingClientRect = (): DOMRect => box({ top: 300, left: 40 });
    act(() => built[0]?.fire());
  }

  it('leaves the page alone while its target has no box', () => {
    render(<Spotlight target=".shut-panel-target" />);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls to the target once it has been measured', () => {
    render(<Spotlight target=".shut-panel-target" />);
    sizeAndFire();

    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('does not scroll again when the same target is measured again', () => {
    render(<Spotlight target=".shut-panel-target" />);
    sizeAndFire();
    sizeAndFire();

    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('sweeps there under full motion', () => {
    render(<Spotlight target=".shut-panel-target" />);
    sizeAndFire();

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('jumps there under reduced motion', () => {
    setReducedMotion(true);
    render(<Spotlight target=".shut-panel-target" />);
    sizeAndFire();

    expect(scrollTo).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' });
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
const titleCss = readFileSync(
  locate(join('apps', 'web', 'src', 'screens', 'TitleScreen.css')),
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

  /* The title screen is the other full-screen take-over, and disagreeing with the
     return summary about which layer a take-over sits on would let the dim fall
     across whichever one lost. It shares the return summary's layer and stands
     above the prompt bar, same as the return summary does. */
  it("sits the title screen on the return summary's layer, above the prompt bar", () => {
    expect(zIndex(titleCss, '.title')).toBeGreaterThanOrEqual(zIndex(returnCss, '.return'));
    expect(zIndex(titleCss, '.title')).toBeGreaterThan(zIndex(appCss, '.shell__prompt'));
  });
});
