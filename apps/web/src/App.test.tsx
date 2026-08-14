import Decimal from 'break_eternity.js';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY, CURRENT_ONBOARDING } from '@dm/content';
import type { Content } from '@dm/content';
import { createState, exportSave, serialize, type SaveBlob } from '@dm/engine';
import type { Intent, IntentFailure, IntentResult } from '@dm/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import {
  finishOnboarding,
  forgetOnboarding,
  readOnboarding,
  writeOnboarding,
} from './game/onboarding.ts';
import { spotlightFor } from './game/spotlight.ts';
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
 * A blow already struck and a Minion already idle, so a beat on each track is ready at once.
 *
 * `orders` waits on the Minion having cycled and stopped, and both Malice beats that can be
 * first wait on a lifetime blow. This is the contention the two tracks are arbitrated over.
 */
function struckMidRunBlob(): SaveBlob {
  const state = createState(CURRENT);
  state.gens.minion.lifetimeProduced = new Decimal(5);
  state.stats.smites = 1;
  state.smiteApathy = 1;
  return serialize(state, Date.now());
}

/*
 * A blow struck and Evil enough to fill the Minion Hand's post.
 *
 * With the three beats before it consumed, `appoint` is the Dominion beat standing next and
 * Malice is in front of it. That is the board the soft-lock was reachable from: her beats gate
 * nothing, so the post's button is live while she talks, and the appointment it takes has to be
 * recorded against a beat that is nowhere on the screen.
 */
function struckAndFundedBlob(): SaveBlob {
  const state = createState(CURRENT);
  state.resources.evil = new Decimal(5000);
  state.stats.smites = 1;
  return serialize(state, Date.now());
}

/*
 * A blow struck and Evil enough to walk the whole Dominion track without waiting for income.
 *
 * Twenty thousand covers the Hand's post, a Minion, a Warren and the change, and it meets the
 * Warren's row on the first reconcile — a tier is met at half the price of its first unit, so
 * the row the `warren` beat points at is drawn from the opening frame.
 */
function struckAndRichBlob(): SaveBlob {
  const state = createState(CURRENT);
  state.resources.evil = new Decimal(20_000);
  state.stats.smites = 1;
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
    writeOnboarding({ dominion: ['stir'], malice: [], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(midRunBlob());
    render(<App />);

    expect(await screen.findByText(CURRENT_COPY.onboarding.dominion.orders)).toBeInTheDocument();
  });

  it('leaves the resumed beat off the bar once it has been consumed', async () => {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false, caved: false });
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

describe("the engine's answer decides, not the click", () => {
  const onboarding = CURRENT_COPY.onboarding;
  const minions = CURRENT.tiers.find((tier) => tier.id === 'minion')?.plural ?? '';
  const rouseMinions = CURRENT_COPY.overseer.rouse(minions);
  const smiteName = new RegExp(`^${CURRENT_COPY.smite.action}\\.`);
  /* Her two lists. `struckBlob` leaves the cooldown clear and Apathy at 1, so she opens on
     the calmest waiting line; a second blow starts a cooldown and moves her to the urging
     line for two lifetime blows. No blow consumes a beat any more, so the line she is on is
     what reports whether the dispatch ran. */
  const herWaitingLine = onboarding.waiting[0]?.line ?? '';
  const herUrgingLine = onboarding.urging[1] ?? '';

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

  it('leaves her on the same line when the blow is turned down', async () => {
    refusal.refuses = { kind: 'smite', reason: 'smite-cooling' };
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByText(herWaitingLine);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(screen.getByText(herWaitingLine)).toBeInTheDocument();
  });

  it('moves her to her next line when the blow lands', async () => {
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByText(herWaitingLine);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(await screen.findByText(herUrgingLine)).toBeInTheDocument();
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

  /**
   * Strikes during the Dominion track and winds until the next Dominion beat is ready.
   *
   * Rousing consumes `stir`, so the opening beat's hold on the bar is released; the blow
   * starts the Malice track; the fifteen seconds let the Minion cycle and stop, which is
   * `orders`. That is a beat waiting on each track at once.
   */
  async function struckDuringDominion(): Promise<void> {
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
   * Consumes `first-blow` by dismissal, which is the moment `goad` takes the bar.
   *
   * She is the only beat in either track carrying a retirement window, so any test that
   * needs one to close needs her on screen first. `first-blow` does not retire, so a
   * dismissal is the only way past it — and she is ready on the same blow he was, so
   * there is nothing to wait for.
   */
  async function revealsGoad(): Promise<void> {
    await struckDuringDominion();
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));
    await screen.findByRole('status', { name: onboarding.herLabel });
  }

  it('retires the beat once its own window closes', async () => {
    await revealsGoad();
    wind(76_000);

    expect(screen.queryByRole('status', { name: onboarding.herLabel })).not.toBeInTheDocument();
  });

  it('does not bring a retired beat back when it becomes ready again', async () => {
    await revealsGoad();
    wind(76_000);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    wind(21_000);

    expect(screen.queryByRole('status', { name: onboarding.herLabel })).not.toBeInTheDocument();
  });

  it('restarts her window when the player strikes', async () => {
    await revealsGoad();
    wind(70_000);
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
    wind(30_000);

    expect(screen.getByRole('status', { name: onboarding.herLabel })).toBeInTheDocument();
  });
});

/*
 * One bar, and who holds it, per the 2026-08-14 design spec §6.
 *
 * Malice takes the bar as soon as it has something to say and holds it until it ends. It
 * losing to Dominion is what cut into her conversation: the track began on a blow struck
 * during the ten-minute opening, was crowded off the bar, and was then interrupted by the
 * next Dominion beat coming ready. Nothing is lost by making Dominion wait — none of its
 * beats carries a window and none of them is ready off anything that decays.
 */
describe('the malice track holds the bar', () => {
  const onboarding = CURRENT_COPY.onboarding;
  const smiteName = new RegExp(`^${CURRENT_COPY.smite.action}\\.`);
  const appointHand = new RegExp(`^${CURRENT_COPY.overseer.names['minion-hand']}`);
  const miscreantsTab = new RegExp(`^${CURRENT_COPY.overseer.panelTitle}`);
  const musterTab = new RegExp(`^${CURRENT_COPY.rail.title}`);
  const warrens = CURRENT.tiers.find((tier) => tier.id === 'warren')?.plural ?? '';
  const rouseWarrens = CURRENT_COPY.overseer.rouse(warrens);

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

  /**
   * Fills the Minion Hand's post while she is on the bar and `appoint` is next in Dominion.
   *
   * The post's button is live because her beats gate nothing, so this is an ordinary thing
   * for a player to do — and the beat it answers is one they have never been shown.
   */
  async function appointsDuringHerTurn(): Promise<void> {
    writeOnboarding({
      dominion: ['stir', 'orders', 'muster'],
      malice: [],
      done: false,
      caved: false,
    });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckAndFundedBlob());
    render(<App />);
    await screen.findByText(onboarding.malice['first-blow']);

    await fillsThePost();
  }

  async function fillsThePost(): Promise<void> {
    await userEvent.click(screen.getByRole('tab', { name: miscreantsTab }));
    await userEvent.click(screen.getByRole('button', { name: appointHand }));
    // The post opens a confirmation rather than appointing on the press. The beat is
    // answered by the dispatch behind the second button, never by the first.
    await userEvent.click(
      await screen.findByRole('button', { name: CURRENT_COPY.overseer.confirmAction }),
    );
  }

  /**
   * Buys from a rail row by its tier rather than by the label the row happens to carry.
   *
   * The label holds the quantity and the live price, so matching it would be a second copy
   * of `rail.buy` and of whatever the quantity chip defaults to. The row's own attribute is
   * what the spotlight already points at.
   */
  async function buy(tierId: string): Promise<void> {
    const row = document.querySelector<HTMLButtonElement>(
      `.rail__row[data-tier="${tierId}"] button`,
    );
    if (row !== null) await userEvent.click(row);
  }

  /**
   * Fills the Hand's post while a beat *earlier* than `appoint` is the Dominion candidate.
   *
   * The narrower stall, and the one `accomplishedBeat` exists for. `acted` rightly records
   * nothing — `muster` gates a purchase, not an appointment — so the beat is not consumed by
   * the click, and `can-afford-overseer` will refuse to be ready for a post that cannot be
   * filled twice. Without a fourth answer the track simply stops when it reaches `appoint`.
   */
  async function appointsBeforeTheTrackAsks(): Promise<void> {
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    writeOnboarding({ dominion: ['stir', 'orders'], malice: [], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckAndRichBlob());
    render(<App />);
    await screen.findByText(onboarding.malice['first-blow']);

    await fillsThePost();
    await userEvent.click(screen.getByRole('tab', { name: musterTab }));
  }

  async function bothTracksReady(): Promise<void> {
    writeOnboarding({ dominion: ['stir'], malice: [], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckMidRunBlob());
    render(<App />);
    await screen.findAllByRole('tab');
  }

  it('carries the malice line when a beat on each track is ready', async () => {
    await bothTracksReady();

    expect(await screen.findByText(onboarding.malice['first-blow'])).toBeInTheDocument();
  });

  it('keeps the waiting dominion beat off the bar', async () => {
    await bothTracksReady();
    await screen.findByText(onboarding.malice['first-blow']);

    expect(screen.queryByText(onboarding.dominion.orders)).not.toBeInTheDocument();
  });

  it('does not take the bar from the opening beat when the player strikes', async () => {
    await firstRun();
    await userEvent.click(screen.getByRole('button', { name: smiteName }));

    expect(screen.getByText(onboarding.dominion.stir)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: onboarding.skip })).toBeInTheDocument();
  });

  it('gives the bar back to dominion once the verdict is dismissed', async () => {
    writeOnboarding({
      dominion: ['stir'],
      malice: ['first-blow', 'goad'],
      done: false,
      caved: true,
    });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckMidRunBlob());
    render(<App />);
    await screen.findByText(onboarding.malice.verdict.caved);
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));

    expect(await screen.findByText(onboarding.dominion.orders)).toBeInTheDocument();
  });

  it('records a dominion beat the player answered while she held the bar', async () => {
    await appointsDuringHerTurn();

    expect(readOnboarding()?.dominion).toContain('appoint');
  });

  /*
   * The soft-lock, end to end. `appoint` gates every control but the post's own button, and
   * that button is disabled for good once filled — so the beat coming back after her turn had
   * no dismissal, no window and no way out, and nothing written down to survive a reload.
   *
   * The track carrying on to `warren` is the assertion that matters. A beat that is neither
   * consumed nor ready leaves the bar empty and the tutorial silently dead, which passes any
   * test that only looks for the line that should not be there.
   */
  it('carries the dominion track past a post the player filled during her turn', async () => {
    vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    await appointsDuringHerTurn();
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));
    wind(80_000);
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));

    expect(await screen.findByText(onboarding.dominion.warren)).toBeInTheDocument();
    expect(screen.queryByText(onboarding.dominion.appoint)).not.toBeInTheDocument();
  });

  it('consumes a beat whose gated action was already done before the track reached it', async () => {
    await appointsBeforeTheTrackAsks();
    await buy('minion');

    expect(readOnboarding()?.dominion).toContain('appoint');
  });

  /*
   * The whole track, ending where it is written off. A beat that stalls unconsumed and unready
   * costs the player no control — it simply stops the tutorial where it stands, `done` never
   * written, and every later visit resumes on a beat that will never come.
   */
  it('walks the dominion track to its end and writes it off', async () => {
    await appointsBeforeTheTrackAsks();
    await buy('minion');
    await buy('warren');
    await userEvent.click(screen.getByRole('button', { name: rouseWarrens }));
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));
    wind(80_000);
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));
    await userEvent.click(screen.getByRole('button', { name: onboarding.dismiss }));

    expect(readOnboarding()?.done).toBe(true);
  });
});

/*
 * The Malice track's two endings, per the 2026-08-14 design spec §5: caving twice hands
 * the bar to the narrator saying the player listened, and outlasting her window hands it
 * to him saying they did not. Neither could be reached before this task — the verdict
 * waited on an Apathy band it held for five seconds, so it withdrew unread and came back
 * on the next blow.
 *
 * `struckBlob` starts with the opening strike already behind it — one smite, Apathy at 1 —
 * which is exactly `first-blow`'s own readiness. With `first-blow` marked consumed, `goad`
 * is showing from the first render, and two more blows end her.
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
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByRole('status', { name: onboarding.herLabel });
  }

  async function strike(): Promise<void> {
    await userEvent.click(screen.getByRole('button', { name: smiteName }));
  }

  it('keeps her on the bar after a single strike', async () => {
    await findsHer();
    wind(10_000);
    await strike();
    wind(21_000);

    expect(screen.getByRole('status', { name: onboarding.herLabel })).toBeInTheDocument();
  });

  it('hands the bar to the narrator once the player has caved twice', async () => {
    await findsHer();
    await strike();
    wind(21_000);
    await strike();

    expect(await screen.findByText(onboarding.malice.verdict.caved)).toBeInTheDocument();
  });

  /*
   * The §2 defect, and the case that fails on the shipped code. Sixty seconds between
   * blows is longer than the forty-five Apathy takes to bleed a whole point away, so the
   * gauge is back at zero before each cave and the old band-2 condition could never come
   * true however many times the player gave in.
   */
  it('reaches the caved ending however far apart the blows are spaced', async () => {
    await findsHer();
    wind(60_000);
    await strike();
    wind(60_000);
    await strike();

    expect(await screen.findByText(onboarding.malice.verdict.caved)).toBeInTheDocument();
  });

  it('hands the bar to the narrator when the player outlasts her', async () => {
    await findsHer();
    wind(80_000);

    expect(await screen.findByText(onboarding.malice.verdict.resisted)).toBeInTheDocument();
  });

  /*
   * The five-second regression. The verdict latches, so once it is up it stays up whatever
   * Apathy does — and sixty seconds is more than the bleed needs to carry the gauge back
   * under the band the shipped beat waited on.
   */
  it('keeps the verdict on the bar while apathy bleeds away beneath it', async () => {
    await findsHer();
    await strike();
    wind(21_000);
    await strike();
    await screen.findByText(onboarding.malice.verdict.caved);
    wind(60_000);

    expect(screen.getByText(onboarding.malice.verdict.caved)).toBeInTheDocument();
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
    writeOnboarding({ dominion: ['stir'], malice: [], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByText(onboarding.malice['first-blow']);

    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--soft');
  });

  /*
   * She is the one beat naming a control it does not gate, and her gate is `none` — so the
   * dim reaching anything at all is the whole assertion. Handed the gate rather than the
   * beat, or handed a beat whose `points` is ignored, this falls to the soft weight the
   * narrative beat above it draws. Which selector she names is the anchor test's job.
   */
  it('frames a control while she is on the bar', async () => {
    writeOnboarding({ dominion: ['stir'], malice: ['first-blow'], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(struckBlob());
    render(<App />);
    await screen.findByRole('status', { name: onboarding.herLabel });

    expect(screen.getByTestId('spotlight')).toHaveClass('spotlight--whole');
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

  it('holds the dim back while the return summary is up', async () => {
    await firstRun();
    await userEvent.click(screen.getByRole('button', { name: 'Away 1h' }));
    await screen.findByRole('dialog');

    expect(screen.queryByTestId('spotlight')).toBeNull();
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
    writeOnboarding({ dominion: [], malice: [], done: false, caved: false });
    vi.spyOn(storage, 'readSave').mockResolvedValue(metEveryTierBlob());
    render(<App />);
    await screen.findByText(onboarding.dominion.stir);

    for (const beat of [...CURRENT_ONBOARDING.dominion, ...CURRENT_ONBOARDING.malice]) {
      const { target, panel } = spotlightFor(beat);
      if (target === undefined) continue;
      if (panel !== undefined) await openPanel(panel);

      expect(document.querySelector(target)).toBeVisible();
    }
  });
});
