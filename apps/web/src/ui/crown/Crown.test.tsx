import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import { describe, expect, it, vi } from 'vitest';
import { Crown } from './Crown.tsx';

function seeded(evil: number, souls = 0) {
  const state = createState(CURRENT);
  state.resources.evil = new Decimal(evil);
  state.souls = new Decimal(souls);
  return state;
}

describe('Crown', () => {
  it('shows the standing Evil through the shared formatter', () => {
    render(
      <Crown
        state={seeded(4875)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction={false}
        onSmite={vi.fn()}
      />,
    );

    expect(screen.getByText('4.88K')).toBeInTheDocument();
  });

  it('names the rate of production', () => {
    render(
      <Crown
        state={seeded(0)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction={false}
        onSmite={vi.fn()}
      />,
    );

    expect(screen.getByText(/Evil per second/)).toBeInTheDocument();
  });

  it('says nothing about souls before any have been claimed', () => {
    render(
      <Crown
        state={seeded(0)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction={false}
        onSmite={vi.fn()}
      />,
    );

    expect(screen.queryByText(/souls/)).not.toBeInTheDocument();
  });

  it('names what souls bought once there are any', () => {
    render(
      <Crown
        state={seeded(0, 50)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction={false}
        onSmite={vi.fn()}
      />,
    );

    expect(screen.getByText(/×2 to everything/)).toBeInTheDocument();
  });

  it('lifts Smite to the accent while nothing can be bought', () => {
    render(
      <Crown
        state={seeded(0)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction
        onSmite={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Smite' })).toHaveClass('button--primary');
  });

  it('drops Smite back to secondary once a purchase is the move', () => {
    render(
      <Crown
        state={seeded(1e9)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction={false}
        onSmite={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Smite' })).not.toHaveClass('button--primary');
  });

  it('reports a smite to its caller', async () => {
    const onSmite = vi.fn();
    render(
      <Crown
        state={seeded(0)}
        content={CURRENT}
        copy={CURRENT_COPY}
        smiteIsTheAction
        onSmite={onSmite}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Smite' }));

    expect(onSmite).toHaveBeenCalledOnce();
  });
});
