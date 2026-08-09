import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState, msToNextSoul, prestigeGain, type GameState } from '@dm/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatNumber, formatDuration } from '../format.ts';
import { PrestigePanel } from './PrestigePanel.tsx';

function soulsFor(lifetimeEvil: string): Decimal {
  const at = createState(CURRENT);
  at.lifetimeEvil = new Decimal(lifetimeEvil);
  return prestigeGain(at, CURRENT);
}

let state: GameState;

beforeEach(() => {
  state = createState(CURRENT);
});

function draw(onPrestige = vi.fn()) {
  return {
    onPrestige,
    ...render(
      <PrestigePanel
        content={CURRENT}
        state={state}
        version={1}
        onPrestige={onPrestige}
        copy={CURRENT_COPY.prestige}
      />,
    ),
  };
}

const CLAIM = CURRENT_COPY.prestige.claim(formatNumber(soulsFor('1e16')));
const CONFIRM = new RegExp(CURRENT_COPY.prestige.confirmAction);

describe('PrestigePanel', () => {
  it('disables the claim while no souls are owed', () => {
    draw();

    expect(screen.getByRole('button', { name: CURRENT_COPY.prestige.noneOwed })).toBeDisabled();
  });

  it('says why the claim is disabled rather than leaving it dead', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.prestige.unavailable)).toBeInTheDocument();
  });

  it('names the souls a reckoning would owe', () => {
    state.lifetimeEvil = new Decimal('1e16');

    draw();

    expect(screen.getByRole('button', { name: CLAIM })).toBeEnabled();
  });

  it('names the multiplier the souls already grant', () => {
    state.souls = new Decimal(200);

    draw();

    expect(screen.getByText('×1.2')).toBeInTheDocument();
  });

  it('names the share a soul is worth', () => {
    draw();

    expect(screen.getByText(/0\.1% each/)).toBeInTheDocument();
  });

  it('says what a soul adds, in the same share as the favour line', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.prestige.worth('0.1%'))).toBeInTheDocument();
  });

  it('shows the favour a large soul count buys', () => {
    state.souls = new Decimal(1800);

    draw();

    expect(screen.getByText('×2.8')).toBeInTheDocument();
  });

  it('says the souls will wait once they are owed', () => {
    state.lifetimeEvil = new Decimal('1e16');

    draw();

    expect(screen.getByText(CURRENT_COPY.prestige.available)).toBeInTheDocument();
  });

  it('names what a reset takes', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.prestige.clears)).toBeInTheDocument();
  });

  it('heads the losses with what they are', () => {
    draw();

    expect(screen.getByRole('heading', { name: CURRENT_COPY.prestige.clearsTitle })).toBeVisible();
  });

  it('names what a reset leaves', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.prestige.keeps)).toBeInTheDocument();
  });

  it('heads the keeps with what they are', () => {
    draw();

    expect(screen.getByRole('heading', { name: CURRENT_COPY.prestige.keepsTitle })).toBeVisible();
  });

  it('never spends the accent on a destructive action', () => {
    state.lifetimeEvil = new Decimal('1e16');

    const { container } = draw();

    expect(container.querySelector('.button--primary')).toBeNull();
  });

  it('asks before resetting rather than firing on the first press', async () => {
    state.lifetimeEvil = new Decimal('1e16');

    const { onPrestige } = draw();
    await userEvent.click(screen.getByRole('button', { name: CLAIM }));

    expect(onPrestige).not.toHaveBeenCalled();
  });

  it('opens the confirmation on the claim', async () => {
    state.lifetimeEvil = new Decimal('1e16');

    draw();
    await userEvent.click(screen.getByRole('button', { name: CLAIM }));

    expect(screen.getByRole('button', { name: CONFIRM })).toBeInTheDocument();
  });

  it('keeps the confirmation shut until it is asked for', () => {
    state.lifetimeEvil = new Decimal('1e16');

    draw();

    expect(screen.queryByRole('button', { name: CONFIRM })).toBeNull();
  });

  it('fires the reset once the player confirms it', async () => {
    state.lifetimeEvil = new Decimal('1e16');

    const { onPrestige } = draw();
    await userEvent.click(screen.getByRole('button', { name: CLAIM }));
    await userEvent.click(screen.getByRole('button', { name: CONFIRM }));

    expect(onPrestige).toHaveBeenCalledOnce();
  });

  it('leaves the realm standing when the player backs out', async () => {
    state.lifetimeEvil = new Decimal('1e16');

    const { onPrestige } = draw();
    await userEvent.click(screen.getByRole('button', { name: CLAIM }));
    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.prestige.cancel }));

    expect(onPrestige).not.toHaveBeenCalled();
  });

  it('shuts the confirmation again when the player backs out', async () => {
    state.lifetimeEvil = new Decimal('1e16');

    draw();
    await userEvent.click(screen.getByRole('button', { name: CLAIM }));
    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.prestige.cancel }));

    expect(screen.queryByRole('button', { name: CONFIRM })).toBeNull();
  });

  it('reports how long this run has lasted', () => {
    state.stats.runMs = 4_320_000;

    draw();

    expect(screen.getByText('1h 12m')).toBeInTheDocument();
  });

  it('reports how long the next soul will take', () => {
    state.gens.minion.owned = new Decimal(1000);
    state.overseers.minion = ['minion-hand'];

    draw();

    const waitMs = msToNextSoul(state, CURRENT);
    expect(waitMs).not.toBeNull();

    const term = screen.getByText(CURRENT_COPY.prestige.nextSoul);
    expect(term.nextElementSibling?.textContent).toBe(formatDuration(waitMs ?? 0));
  });

  it('says nothing definite when nothing is running', () => {
    draw();

    expect(screen.getByText(CURRENT_COPY.prestige.nextSoulUnknown)).toBeInTheDocument();
  });
});
