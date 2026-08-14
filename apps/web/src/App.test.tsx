import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState, serialize, type SaveBlob } from '@dm/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { forgetOnboarding, hasSeenOnboarding, markOnboardingSeen } from './game/onboarding.ts';
import * as storage from './game/storage.ts';

function savedBlob(): SaveBlob {
  return serialize(createState(CURRENT), Date.now());
}

describe('the deck and the records', () => {
  beforeEach(() => markOnboardingSeen());
  afterEach(() => forgetOnboarding());

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

describe('first-run onboarding', () => {
  beforeEach(() => forgetOnboarding());

  afterEach(() => {
    forgetOnboarding();
    vi.restoreAllMocks();
  });

  it('opens on the first beat for a new player', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);

    expect(await screen.findByText(CURRENT_COPY.onboarding.dominion.stir)).toBeInTheDocument();
  });

  it('says nothing to a returning player', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(savedBlob());
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('says nothing to a player who has seen it before', async () => {
    markOnboardingSeen();
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('clears every prompt when the player skips', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: CURRENT_COPY.onboarding.skip }),
    );

    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('remembers a skip across visits', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: CURRENT_COPY.onboarding.skip }),
    );

    expect(hasSeenOnboarding()).toBe(true);
  });
});
