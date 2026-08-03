import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import { describe, expect, it, vi } from 'vitest';
import { Crown } from './Crown.tsx';

function seeded(evil: number, souls = 0, smites = 0) {
  const state = createState(CURRENT);
  state.resources.evil = new Decimal(evil);
  state.souls = new Decimal(souls);
  state.stats.smites = smites;
  return state;
}

function crown(overrides: Partial<Parameters<typeof Crown>[0]> = {}) {
  return (
    <Crown
      state={seeded(0)}
      content={CURRENT}
      copy={CURRENT_COPY}
      smiteIsTheAction={false}
      onSmite={vi.fn()}
      {...overrides}
    />
  );
}

function strike() {
  return screen.getByRole('button', { name: /^Smite\./ });
}

describe('Crown', () => {
  it('shows the standing Evil through the shared formatter', () => {
    render(crown({ state: seeded(4875) }));

    expect(screen.getByText('4.88K')).toBeInTheDocument();
  });

  it('names the rate of production', () => {
    render(crown());

    expect(screen.getByText(/Evil per second/)).toBeInTheDocument();
  });

  it('makes the Evil total itself the tap target', () => {
    render(crown({ state: seeded(4875) }));

    expect(strike()).toHaveTextContent('4.88K');
  });

  it('speaks the figure as well as the verb', () => {
    render(crown({ state: seeded(4875) }));

    expect(strike()).toHaveAccessibleName('Smite. You hold 4.88K Evil.');
  });

  it('says nothing about souls before any have been claimed', () => {
    render(crown());

    expect(screen.queryByText(/souls/)).not.toBeInTheDocument();
  });

  it('names what souls bought once there are any', () => {
    render(crown({ state: seeded(0, 50) }));

    expect(screen.getByText(/×2 to everything/)).toBeInTheDocument();
  });

  it('lifts the strike to the accent while nothing can be bought', () => {
    render(crown({ smiteIsTheAction: true }));

    expect(strike()).toHaveClass('crown__strike--lifted');
  });

  it('drops the strike back to secondary once a purchase is the move', () => {
    render(crown({ state: seeded(1e9) }));

    expect(strike()).not.toHaveClass('crown__strike--lifted');
  });

  it('reports a smite to its caller', async () => {
    const onSmite = vi.fn();
    render(crown({ smiteIsTheAction: true, onSmite }));

    await userEvent.click(strike());

    expect(onSmite).toHaveBeenCalledOnce();
  });

  it('says nothing about the last blow before one has been struck', () => {
    const { container } = render(crown());

    expect(container.querySelector('.crown__report')).toBeEmptyDOMElement();
  });

  it('reports what the last blow came to', () => {
    render(crown({ state: seeded(0, 0, 1) }));

    expect(screen.getByText(CURRENT_COPY.smite.results[0] ?? '')).toBeInTheDocument();
  });

  it('cycles the report rather than repeating one line', () => {
    const second = CURRENT_COPY.smite.results[1] ?? '';
    render(crown({ state: seeded(0, 0, 2) }));

    expect(screen.getByText(second)).toBeInTheDocument();
  });

  it('wraps the report round at the end of the list', () => {
    const first = CURRENT_COPY.smite.results[0] ?? '';
    render(crown({ state: seeded(0, 0, CURRENT_COPY.smite.results.length + 1) }));

    expect(screen.getByText(first)).toBeInTheDocument();
  });
});
