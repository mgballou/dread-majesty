import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { apply, createState, step } from '@dm/engine';
import { describe, expect, it } from 'vitest';
import { Crown } from './Crown.tsx';

function seeded(souls = 0, appointMinions = false) {
  const state = createState(CURRENT);
  state.souls = new Decimal(souls);
  state.overseers.minion = appointMinions;
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
    step(state, CURRENT, CURRENT.smite.durationMs);
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

    expect(screen.getByText('0.63 Evil per second')).toBeInTheDocument();
  });

  it('says nothing about souls before any have been claimed', () => {
    render(crown());

    expect(screen.queryByText(/Damned Souls/)).not.toBeInTheDocument();
  });

  it('names what souls bought once there are any', () => {
    render(crown(seeded(50)));

    expect(screen.getByText(/×2 to everything/)).toBeInTheDocument();
  });

  it('leaves the verb to the chain', () => {
    render(crown());

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
