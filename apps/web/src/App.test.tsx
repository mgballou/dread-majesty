import Decimal from 'break_eternity.js';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY, CURRENT_ONBOARDING } from '@dm/content';
import type { Content } from '@dm/content';
import { createState, exportSave, serialize, type SaveBlob } from '@dm/engine';
import type { Intent, IntentFailure, IntentResult } from '@dm/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, spotlightFor } from './App.tsx';
import {
  finishOnboarding,
  forgetOnboarding,
  readOnboarding,
  writeOnboarding,
} from './game/onboarding.ts';
import type * as sessionModule from './game/useGameSession.ts';
import type { Session } from './game/useGameSession.ts';
import * as storage from './game/storage.ts';

/*
 * A dispatch the engine refuses, on demand.
 *
 * Every control in the game disables itself before it can send an intent the engine
 * would turn down, so a refusal cannot be produced by clicking — which is exactly why
 * "the beat is consumed by the dispatch, not by the click" had no test and drifted at
 * four call sites. The session hook is the seam the App holds `dispatch` through, so it
 * is the one thing swapped, and only for the tests that set `refuses`. The engine is
 * untouched: it is the real one, running real state.
 */
const refusal = vi.hoisted(() => ({
  refuses: null as { kind: Intent['kind']; reason: IntentFailure } | null,
}));

vi.mock('./game/useGameSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof sessionModule>();

  return {
    ...actual,
    useGameSession: (content: Content): Session => {
      const live = actual.useGameSession(content);
      const refuses = refusal.refuses;
      if (refuses === null) return live;

      return {
        ...live,
        dispatch: (intent: Intent): IntentResult =>
          intent.kind === refuses.kind
            ? { ok: false, intent, reason: refuses.reason }
            : live.dispatch(intent),
      };
    },
  };
});

function savedBlob(): SaveBlob {
  return serialize(createState(CURRENT), Date.now());
}

function midRunBlob(): SaveBlob {
  const state = createState(CURRENT);
  state.gens.minion.lifetimeProduced = new Decimal(5);
  return serialize(state, Date.now());
}

function struckBlob(): SaveBlob {
  const state = createState(CURRENT);
  state.stats.smites = 1;
  state.smiteApathy = 1;
  return serialize(state, Date.now());
}

/*
 * Every rung met, one of each held.
 *
 * The muster draws a row only for a tier the player has met, so the beats that point
 * into it can only be checked on a board that has met the tiers they name. A tier is
 * met at half the price of its first unit, so every beat that gates a purchase is ready
 * only once its row is already drawn — this blob is that board, reached in one step.
 */
function metEveryTierBlob(): SaveBlob {
  const state = createState(CURRENT);
  for (const tier of CURRENT.tiers) {
    state.gens[tier.id].owned = new Decimal(1);
    state.unlocked[tier.id] = true;
  }
  return serialize(state, Date.now());
}

describe('the deck and the records', () => {
  beforeEach(() => finishOnboarding());
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
    finishOnboarding();
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('says nothing to a player holding the legacy flag', async () => {
    localStorage.setItem('dread-majesty:onboarding-seen', '1');
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('writes off a returning player who predates onboarding', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(savedBlob());
    render(<App />);
    await screen.findAllByRole('tab');

    expect(readOnboarding()?.done).toBe(true);
  });

  it('resumes mid-track for a player who reloaded during the tutorial', async () => {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(midRunBlob());
    render(<App />);

    expect(await screen.findByText(CURRENT_COPY.onboarding.dominion.orders)).toBeInTheDocument();
  });

  it('leaves the resumed beat off the bar once it has been consumed', async () => {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(midRunBlob());
    render(<App />);
    await screen.findByText(CURRENT_COPY.onboarding.dominion.orders);

    expect(screen.queryByText(CURRENT_COPY.onboarding.dominion.stir)).not.toBeInTheDocument();
  });

  it('writes down a beat the moment it is consumed', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    const minions = CURRENT.tiers.find((tier) => tier.id === 'minion')?.plural ?? '';
    render(<App />);
    await userEvent.click(
      await screen.findByRole('button', { name: CURRENT_COPY.overseer.rouse(minions) }),
    );

    expect(readOnboarding()?.dominion).toEqual(['stir']);
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

    expect(readOnboarding()?.done).toBe(true);
  });
});

describe('a refused action consumes nothing', () => {
  const onboarding = CURRENT_COPY.onboarding;
  const minions = CURRENT.tiers.find((tier) => tier.id === 'minion')?.plural ?? '';
  const rouseMinions = CURRENT_COPY.overseer.rouse(minions);
  const smiteName = new RegExp(`^${CURRENT_COPY.smite.action}\\.`);
  const herFirstLine = onboarding.goad[0]?.line ?? '';

  beforeEach(() => forgetOnboarding());

  afterEach(() => {
    refusal.refuses = null;
    forgetOnboarding();
    vi.restoreAllMocks();
  });

  it('leaves the beat on the bar when the rouse is turned down', async () => {
    refusal.refuses = { kind: 'rouse', reason: 'tier-not-owned' };
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: rouseMinions }));

    expect(screen.getByText(onboarding.dominion.stir)).toBeInTheDocument();
  });

  it('writes nothing down when the rouse is turned down', async () => {
    refusal.refuses = { kind: 'rouse', reason: 'tier-not-owned' };
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: rouseMinions }));

    expect(readOnboarding()?.dominion).toEqual([]);
  });

  it('leaves her line on the bar when the blow is turned down', async () => {
    refusal.refuses = { kind: 'smite', reason: 'smite-cooling' };
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByText(herFirstLine);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(screen.getByText(herFirstLine)).toBeInTheDocument();
  });

  it('consumes her beat when the blow lands', async () => {
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByText(herFirstLine);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(screen.queryByText(herFirstLine)).not.toBeInTheDocument();
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

  /**
   * Consumes `first-blow` by dismissal and winds to the moment `goad` takes the bar.
   *
   * She is the only Malice beat left carrying a retirement window, so any test that
   * needs one to close now needs her on screen first. `first-blow` no longer retires,
   * so a dismissal is the only way past it.
   */
  async function revealsGoad(): Promise<void> {
    await struckAndCrowdedOut();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));
    wind(6_000);
    await screen.findByRole('status', { name: onboarding.herLabel });
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
    await revealsGoad();
    wind(121_000);

    expect(screen.queryByRole('status', { name: onboarding.herLabel })).not.toBeInTheDocument();
  });

  it('does not bring a retired beat back when it becomes ready again', async () => {
    await revealsGoad();
    wind(121_000);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    wind(21_000);

    expect(screen.queryByRole('status', { name: onboarding.herLabel })).not.toBeInTheDocument();
  });
});

/*
 * The Malice track's two endings, per the 2026-08-14 design spec §2.1: caving twice
 * hands the bar to the narrator, and resisting lets her walk down to her window and
 * give up. Neither could be reached before this task — she was consumed by the first
 * strike, which put the narrator's reply permanently out of reach.
 *
 * `struckBlob` starts with the opening strike already behind it — one smite, Apathy at
 * 1 — which is exactly `first-blow`'s own readiness. With `first-blow` marked consumed,
 * `goad` is showing from the first render. Each cooldown wait bleeds some of that
 * Apathy away (twenty seconds against a forty-five-second point), so a second cave from
 * there lands short of band 2 and a third is what crosses it — matching §2.2's own
 * account of the ordering. Waiting a full cooldown between clicks, rather than reasoning
 * about an exact number, is also what keeps these tests honest against the small
 * real-time catch-up the save-load path always runs.
 */
describe('the Malice conversation resolves', () => {
  const onboarding = CURRENT_COPY.onboarding;
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

  async function findsHer(): Promise<void> {
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByRole('status', { name: onboarding.herLabel });
  }

  it('keeps her on the bar after a single strike', async () => {
    await findsHer();
    wind(10_000);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    wind(21_000);

    expect(screen.getByRole('status', { name: onboarding.herLabel })).toBeInTheDocument();
  });

  it('hands the bar to the narrator once the realm stops looking', async () => {
    await findsHer();
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    wind(21_000);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(await screen.findByText(onboarding.malice.apathy)).toBeInTheDocument();
  });

  it('lets her give up when the player resists', async () => {
    await findsHer();
    wind(121_000);

    expect(screen.queryByRole('status', { name: onboarding.herLabel })).not.toBeInTheDocument();
    expect(screen.queryByText(onboarding.malice.apathy)).not.toBeInTheDocument();
  });
});

/*
 * The dim, and the panel a beat reaches into.
 *
 * jsdom measures every element as zero, so a beat that names a control always falls back
 * to dimming the whole screen here rather than cutting its hole. Both classes carry the
 * full scrim and only the soft one means "points at nothing", so the class is asserted as
 * either. The geometry, the click through the lit region and the ring's pulse are the
 * browser pass's to check.
 */
describe('the spotlight follows the beat', () => {
  const onboarding = CURRENT_COPY.onboarding;
  const minions = CURRENT.tiers.find((tier) => tier.id === 'minion')?.plural ?? '';
  const rouseMinions = CURRENT_COPY.overseer.rouse(minions);
  const musterTab = new RegExp(`^${CURRENT_COPY.rail.title}`);
  const deedsTab = new RegExp(`^${CURRENT_COPY.deeds.title}`);

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

  async function firstRun(): Promise<void> {
    vi.spyOn(storage, 'readSave').mockResolvedValue(null);
    render(<App />);
    await screen.findByText(onboarding.dominion.stir);
  }

  async function fundTheRealm(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: 'Set' }));
  }

  /**
   * Brings a deck panel forward by its id rather than by its name.
   *
   * The deck builds both ids off the tab's own id, so this needs no second copy of the
   * panel titles — which is the whole point of a test that enumerates from the content.
   * A panel that cannot be found is left shut, and the assertion that follows fails on
   * an element nobody can see.
   */
  async function openPanel(panel: string): Promise<void> {
    const tab = document.querySelector<HTMLButtonElement>(`[role="tab"][id$="-${panel}-tab"]`);
    if (tab !== null) await userEvent.click(tab);
  }

  it('dims around the control the opening beat names', async () => {
    await firstRun();

    expect(screen.getByTestId('spotlight').className).toMatch(/spotlight--(cutout|whole)/);
  });

  it('dims at the lighter weight for a beat that names nothing', async () => {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByText(onboarding.malice['first-blow']);

    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--soft');
  });

  it('brings the muster forward when the beat points into it', async () => {
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    await firstRun();
    await userEvent.click(screen.getByRole('tab', { name: deedsTab }));
    await fundTheRealm();
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    wind(15_000);
    await userEvent.click(screen.getByRole('button', { name: rouseMinions }));
    await screen.findByText(onboarding.dominion.muster);

    expect(screen.getByRole('tab', { name: musterTab })).toHaveAttribute('aria-selected', 'true');
  });

  it('dims nothing once onboarding is over', async () => {
    vi.spyOn(storage, 'readSave').mockResolvedValue(savedBlob());
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByTestId('spotlight')).toBeNull();
  });

  /*
   * The anchor. `spotlightFor` writes selectors, and a renamed class or attribute would
   * lose the dim with every other test still green — so this walks the shipped tracks
   * themselves and asks the screen for what each beat names. A track that gains a beat is
   * covered the day it is written; a hand-listed set of selectors would not be.
   */
  it('names a control that is on screen for every beat of the shipped tracks', async () => {
    writeOnboarding({ dominion: [], malice: [], done: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(metEveryTierBlob());
    render(<App />);
    await screen.findByText(onboarding.dominion.stir);

    for (const beat of [...CURRENT_ONBOARDING.dominion, ...CURRENT_ONBOARDING.malice]) {
      const { target, panel } = spotlightFor(beat.gate);
      if (target === undefined) continue;
      if (panel !== undefined) await openPanel(panel);

      expect(document.querySelector(target)).toBeVisible();
    }
  });
});
