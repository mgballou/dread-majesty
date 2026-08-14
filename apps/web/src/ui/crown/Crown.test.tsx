import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { apply, createState, smiteDurationMs, step } from '@dm/engine';
import { describe, expect, it } from 'vitest';
import { Crown } from './Crown.tsx';

function seeded(souls = 0, appointMinions = false) {
  const state = createState(CURRENT);
  state.souls = new Decimal(souls);
  state.overseers.minion = appointMinions ? ['minion-hand'] : [];
  return state;
}

function crown(state = seeded()) {
  return <Crown state={state} content={CURRENT} copy={CURRENT_COPY} />;
}

function struck() {
  const state = seeded();
  apply(state, CURRENT, { kind: 'smite' });
  return state;
}

describe('Crown', () => {
  it('invites a blow while one is ready', () => {
    render(crown());

    expect(screen.getByText(CURRENT_COPY.smite.ready)).toBeInTheDocument();
  });

  it('says what is happening while a blow runs, not how long until the next', () => {
    render(crown(struck()));

    expect(screen.getByText(CURRENT_COPY.smite.reigning)).toBeInTheDocument();
  });

  it('never says the surge is a wait', () => {
    render(crown(struck()));

    expect(screen.queryByText(/til ready/)).not.toBeInTheDocument();
  });

  it('counts down only once the surge is spent', () => {
    const state = struck();
    step(state, CURRENT, smiteDurationMs(state, CURRENT));
    render(crown(state));

    expect(screen.getByText(/til ready/)).toBeInTheDocument();
  });

  it('names the rate of production', () => {
    render(crown());

    expect(screen.getByText(/Evil per second/)).toBeInTheDocument();
  });

  it('reports nothing per second while nothing runs on its own', () => {
    render(crown());

    expect(screen.getByText('0 Evil per second')).toBeInTheDocument();
  });

  it('counts a tier once somebody oversees it', () => {
    render(crown(seeded(0, true)));

    expect(screen.getByText('1.25 Evil per second')).toBeInTheDocument();
  });

  it('says nothing about souls before any have been claimed', () => {
    render(crown());

    expect(screen.queryByText(/Damned Souls/)).not.toBeInTheDocument();
  });

  it('names what souls bought once there are any', () => {
    render(crown(seeded(1000)));

    expect(screen.getByText(/×2 to everything/)).toBeInTheDocument();
  });

  it('leaves the verb to the chain', () => {
    render(crown());

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('marks the rate figure as active while a blow runs', () => {
    const { container } = render(crown(struck()));

    expect(container.querySelector('.crown__figure')).toHaveAttribute('data-smite', 'active');
  });

  it('marks the rate figure as ready while a blow is ready', () => {
    const { container } = render(crown());

    expect(container.querySelector('.crown__figure')).toHaveAttribute('data-smite', 'ready');
  });

  it('marks the rate figure as cooling once the surge is spent', () => {
    const state = struck();
    step(state, CURRENT, smiteDurationMs(state, CURRENT));
    const { container } = render(crown(state));

    expect(container.querySelector('.crown__figure')).toHaveAttribute('data-smite', 'cooling');
  });

  it('draws the standing beside the rate', () => {
    const { container } = render(crown(struck()));

    expect(container.querySelector('.crown__standing')).toBeInTheDocument();
  });

  it('keeps the standing outside the figure the surge lights', () => {
    const { container } = render(crown(struck()));
    const figure = container.querySelector('.crown__figure');
    const standing = container.querySelector('.crown__standing');

    // `contains` answers false for a missing node as readily as for a node somewhere else,
    // so the standing has to be proved present before its position means anything.
    expect(standing).toBeInTheDocument();
    expect(figure?.contains(standing)).toBe(false);
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

const css = readFileSync(locate(join('apps', 'web', 'src', 'ui', 'crown', 'Crown.css')), 'utf8');

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The declaration body of a single CSS rule, found by its selector text. */
function rule(selector: string): string {
  const pattern = new RegExp(`${escapeForPattern(selector)}\\s*\\{([^}]*)\\}`);
  const match = pattern.exec(css);
  if (!match) throw new Error(`No rule found in Crown.css for selector "${selector}"`);
  return match[1] ?? '';
}

describe('the stylesheet contract', () => {
  it('lights the active rate with the same tone the Evil node uses', () => {
    expect(rule(".crown__figure[data-smite='active']")).toMatch(/var\(--tone-resource\)/);
  });
});
