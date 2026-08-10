import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState, serialize } from '@dm/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { forgetTour, markTourSeen } from './game/tour.ts';
import * as storage from './game/storage.ts';

describe('the deck and the records', () => {
  beforeEach(() => markTourSeen());
  afterEach(() => forgetTour());

  it('shows four tabs', async () => {
    render(<App />);

    expect(await screen.findAllByRole('tab')).toHaveLength(4);
  });

  it('carries a malice tab', async () => {
    render(<App />);

    expect(await screen.findByRole('tab', { name: CURRENT_COPY.malice.title })).toBeInTheDocument();
  });

  it('carries no ledger tab', async () => {
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByRole('tab', { name: CURRENT_COPY.ledger.title })).toBeNull();
  });

  it('reaches the ledger from the footer', async () => {
    render(<App />);

    expect(
      await screen.findByRole('button', { name: CURRENT_COPY.ledger.title }),
    ).toBeInTheDocument();
  });

  it('opens the ledger when the footer button is pressed', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: CURRENT_COPY.ledger.title }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('the first-run tour', () => {
  const tour = CURRENT_COPY.tour;

  afterEach(() => {
    forgetTour();
    vi.restoreAllMocks();
  });

  function withSave(present: boolean): void {
    vi.spyOn(storage, 'readSave').mockResolvedValue(
      present ? serialize(createState(CURRENT), Date.now()) : null,
    );
  }

  it('greets a player with no save', async () => {
    withSave(false);
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: tour.steps.premise.title }),
    ).toBeInTheDocument();
  });

  it('stays away from a returning save', async () => {
    withSave(true);
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByRole('heading', { name: tour.steps.premise.title })).toBeNull();
  });

  it('stays away from a player who has already seen it', async () => {
    withSave(false);
    markTourSeen();
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByRole('heading', { name: tour.steps.premise.title })).toBeNull();
  });

  it('does not come back after being skipped', async () => {
    withSave(false);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: tour.skip }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: tour.steps.premise.title })).toBeNull(),
    );
  });

  it('records itself as seen once skipped', async () => {
    withSave(false);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: tour.skip }));

    const { hasSeenTour } = await import('./game/tour.ts');
    expect(hasSeenTour()).toBe(true);
  });

  it('leaves the game reachable behind it', async () => {
    withSave(false);
    render(<App />);
    await screen.findByRole('heading', { name: tour.steps.premise.title });

    expect(await screen.findAllByRole('tab')).toHaveLength(4);
  });
});
