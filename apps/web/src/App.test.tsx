import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState, exportSave, serialize, type SaveBlob } from '@dm/engine';
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

describe('onboarding drives the interface', () => {
  const onboarding = CURRENT_COPY.onboarding;
  const minions = CURRENT.tiers.find((tier) => tier.id === 'minion')?.plural ?? '';
  const rouseMinions = CURRENT_COPY.overseer.rouse(minions);
  const appointHand = new RegExp(`^${CURRENT_COPY.overseer.names['minion-hand']}`);
  /* The strike's accessible name is `smite.spoken`, which carries the live Evil total
     and the Apathy band, so it is matched by its opening rather than in full. The deck's
     tabs take a trailing mark once a spend is waiting, so they are matched the same way. */
  const smiteName = new RegExp(`^${CURRENT_COPY.smite.action}\\.`);
  const miscreantsTab = new RegExp(`^${CURRENT_COPY.overseer.panelTitle}`);

  beforeEach(() => forgetOnboarding());

  afterEach(() => {
    forgetOnboarding();
    vi.restoreAllMocks();
  });

  async function firstRun(): Promise<void> {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findByText(onboarding.dominion.stir);
  }

  async function fundTheRealm(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Set' }));
  }

  async function openMiscreants(): Promise<void> {
    await userEvent.click(screen.getByRole('tab', { name: miscreantsTab }));
  }

  it('holds back a control the beat did not name', async () => {
    await firstRun();
    await fundTheRealm();
    await openMiscreants();

    expect(screen.getByRole('button', { name: appointHand })).toBeDisabled();
  });

  it('leaves the named control live', async () => {
    await firstRun();

    expect(screen.getByRole('button', { name: rouseMinions })).toHaveAttribute(
      'aria-disabled',
      'false',
    );
  });

  it('consumes the beat when the player performs the gated action', async () => {
    await firstRun();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));

    expect(screen.queryByText(onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('lifts the gate once the beat is consumed', async () => {
    await firstRun();
    await fundTheRealm();
    await openMiscreants();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));

    expect(screen.getByRole('button', { name: appointHand })).toBeEnabled();
  });

  it('hands the bar to the malice track once dominion has nothing to say', async () => {
    await firstRun();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(await screen.findByText(onboarding.malice['first-blow'])).toBeInTheDocument();
  });

  it('stops onboarding when the player loads a save from the opening beat', async () => {
    await firstRun();
    await userEvent.click(screen.getByRole('button', { name: onboarding.loadSave }));
    fireEvent.change(screen.getByLabelText(CURRENT_COPY.ledger.blobLabel), {
      target: { value: exportSave(createState(CURRENT), Date.now()) },
    });
    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.ledger.importAction }));

    expect(screen.queryByText(onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('consumes a dismissable beat when the player dismisses it', async () => {
    await firstRun();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    await screen.findByText(onboarding.malice['first-blow']);
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));

    expect(screen.queryByText(onboarding.malice['first-blow'])).not.toBeInTheDocument();
  });
});

/*
 * The retirement clock, driven through the real game loop.
 *
 * Only `performance` and the animation frame are faked, never `setTimeout`: Testing
 * Library decides whether to poll on real timers by looking for a global `jest`, finds
 * none under vitest, and would wait forever on a faked one. Leaving those alone keeps
 * `findBy*` working while the loop is wound by hand. The timers go in before `render`,
 * because the frame the loop schedules on mount is the one being faked.
 *
 * The Minion is left manual throughout, so it pays out five Evil per rouse and stops.
 * That is what holds `muster` out of reach for the length of these tests and leaves the
 * Malice track alone with the bar.
 */
describe('onboarding retires a beat nobody answered', () => {
  const onboarding = CURRENT_COPY.onboarding;
  const minions = CURRENT.tiers.find((tier) => tier.id === 'minion')?.plural ?? '';
  const rouseMinions = CURRENT_COPY.overseer.rouse(minions);
  const smiteName = new RegExp(`^${CURRENT_COPY.smite.action}\\.`);

  beforeEach(() => forgetOnboarding());

  afterEach(() => {
    vi.useRealTimers();
    forgetOnboarding();
    vi.restoreAllMocks();
  });

  function wind(ms: number): void {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  async function struckAndCrowdedOut(): Promise<void> {
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findByText(onboarding.dominion.stir);

    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    await screen.findByText(onboarding.malice['first-blow']);

    wind(15_000);
  }

  it('gives the bar to dominion when a beat comes due mid-malice', async () => {
    await struckAndCrowdedOut();

    expect(screen.getByText(onboarding.dominion.orders)).toBeInTheDocument();
  });

  it('brings a crowded-out beat back rather than retiring it on a stale clock', async () => {
    await struckAndCrowdedOut();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));

    expect(screen.getByText(onboarding.malice['first-blow'])).toBeInTheDocument();
  });

  it('retires the beat once its own window closes', async () => {
    await struckAndCrowdedOut();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    wind(13_000);

    expect(screen.queryByText(onboarding.malice['first-blow'])).not.toBeInTheDocument();
  });

  it('moves the track on to the next beat when one retires', async () => {
    await struckAndCrowdedOut();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    wind(13_000);

    expect(screen.getByRole('status', { name: onboarding.herLabel })).toBeInTheDocument();
  });

  it('retires a beat that clears on something other than a dismissal', async () => {
    await struckAndCrowdedOut();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    wind(13_000);
    wind(121_000);

    expect(screen.queryByRole('status', { name: onboarding.herLabel })).not.toBeInTheDocument();
  });
});
