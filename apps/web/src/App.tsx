import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CURRENT,
  CURRENT_COPY,
  CURRENT_ONBOARDING,
  isDominionBeatId,
  isMaliceBeatId,
  type TierId,
} from '@dm/content';
import type { Copy, DominionBeatId, MaliceBeatId } from '@dm/content';
import { isAppointed, isRousable, isTierUnlocked, prestigeGain } from '@dm/engine';
import type { GameState } from '@dm/engine';
import { useSound } from './audio/useSound.ts';
import { DevBar } from './dev/DevBar.tsx';
import {
  accomplishedBeat,
  clearsBeat,
  finishOnboarding,
  herLine,
  isGatedOut,
  onboardingDecision,
  readOnboarding,
  shouldRetire,
  showingBeat,
  supersededBeat,
  writeOnboarding,
  type ClearingAction,
  type GatedControl,
} from './game/onboarding.ts';
import { isPrestigeWorthShowing } from './game/reveals.ts';
import { spotlightFor } from './game/spotlight.ts';
import { useGameSession } from './game/useGameSession.ts';
import { Ledger } from './screens/Ledger.tsx';
import { OfflineSummary } from './screens/OfflineSummary.tsx';
import { TitleScreen } from './screens/TitleScreen.tsx';
import { Trophies } from './screens/Trophies.tsx';
import { Deck, type DeckTab } from './ui/Deck.tsx';
import { Prompt } from './ui/Prompt.tsx';
import { Sheet } from './ui/Sheet.tsx';
import { Spotlight } from './ui/Spotlight.tsx';
import { Crown } from './ui/crown/Crown.tsx';
import { BuyRail } from './ui/rail/BuyRail.tsx';
import { Miscreants } from './ui/rail/Miscreants.tsx';
import { PrestigeLocked } from './ui/rail/PrestigeLocked.tsx';
import { PrestigeMarker } from './ui/rail/PrestigeMarker.tsx';
import { PrestigePanel } from './ui/rail/PrestigePanel.tsx';
import { useBuyQuantity } from './ui/rail/useBuyQuantity.ts';
import { useRailPlan } from './ui/rail/useRailPlan.ts';
import { ChainStage } from './ui/stage/ChainStage.tsx';
import { Malice } from './ui/malice/Malice.tsx';
import { useReducedMotion } from './ui/useReducedMotion.ts';
import './App.css';

/**
 * The one screen.
 *
 * The frame persists and nothing here rebuilds to show that it is loading: the stage,
 * the deck and the crown are mounted once and only their contents change. The return
 * summary is an overlay over that frame, never a replacement for it.
 *
 * The deck holds muster, miscreants, deeds and malice — four is what its tube fits. The
 * ledger is reached from the footer instead of a fifth tab: it is a record rather than
 * a spend, it takes over the screen when it opens, and a thing that does that belongs
 * outside the row of things you spend on rather than beside them.
 *
 * **One accent per region, and the regions do not move.** The stage's is Smite,
 * whenever the blow is ready. The open panel's is the best affordable spend in that
 * panel — the muster lifts a purchase, the miscreants an appointment, and neither can
 * take the other's gold because they are never on screen together. The deck shows one
 * panel at a time, so this is ui-sensibility §3 honoured rather than bent: the old
 * single winner across both panels routinely left the panel you were looking at with no
 * accent at all.
 *
 * The plan holds its choice. Scores are recomputed every slice and near-ties flipped
 * constantly, so a challenger must beat the lifted option by a quarter before the gold
 * moves. See `railPlan`'s `STICKY_MARGIN`.
 *
 * The prestige panel is still held back rather than shown at zero: a currency at zero
 * with no route to earning any teaches nothing.
 */
export function App(): ReactNode {
  const content = CURRENT;
  const copy = CURRENT_COPY;
  const onboarding = CURRENT_ONBOARDING;
  const session = useGameSession(content);
  const sound = useSound();
  // One owner for the setting. It prices every row of the muster and it prices the
  // plan the whole screen is arranged around; two copies of it would drift.
  const { quantity, setQuantity } = useBuyQuantity();

  // The ledger is a record lifted over the game, not a panel of it. `Sheet` listens on
  // the dialog's own `close` event, so the closer has to be stable or the listener is
  // torn down and rebuilt every render.
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const closeLedger = useCallback(() => setLedgerOpen(false), []);

  /**
   * Onboarding, for a first run and whatever is left of it afterwards.
   *
   * The decision is `onboardingDecision`'s; this holds the answer. Latched into state
   * rather than read every render, so onboarding cannot reappear mid-session.
   *
   * The consumed lists are seeded from what is written down, so a reload eleven minutes
   * into an eleven-minute tutorial comes back to the beat the player was on rather than
   * to nothing at all. The autosave lands after ten seconds, so without this the second
   * visit of every first run would find a save on disk and end the tutorial at beat two.
   */
  const [running, setRunning] = useState(false);
  const decided = useRef(false);
  /**
   * Whether the player has pressed Start Game this session.
   *
   * Latched rather than derived, because `session.fresh` stays true for the whole session — a
   * reset later must not put the title screen back in front of a player who is mid-run.
   */
  const [started, setStarted] = useState(false);
  const [doneDominion, setDoneDominion] = useState<readonly DominionBeatId[]>([]);
  const [doneMalice, setDoneMalice] = useState<readonly MaliceBeatId[]>([]);
  /** Whether she got what she asked for. Decides which line the verdict carries. */
  const [caved, setCaved] = useState(false);
  /**
   * The beat on screen, and two counts that are emphatically not the same fact.
   *
   * `arrivedAtSmites` is where the beat's own conversation started. It is taken once, when the
   * beat reaches the screen, and never touched again. Her supersession counts caves from it,
   * so that blows struck before she spoke cannot answer her — see the spec §2.
   *
   * `clockFromMs` is where the retirement clock is measured from, and it is re-taken on every
   * blow. A beat asking for an action that the player then takes has been answered, and giving
   * up on them ten seconds after they caved reads as the tutorial not watching. `clockFromSmites`
   * exists only to notice that a blow landed; nothing reads it as a count.
   *
   * **The re-take is why one field cannot serve both.** After a cave, a single count equals the
   * live one, and "caves since she arrived" is then always zero.
   */
  const shownAt = useRef<{
    id: string;
    arrivedAtSmites: number;
    clockFromMs: number;
    clockFromSmites: number;
  } | null>(null);

  useEffect(() => {
    if (!session.ready || decided.current) return;
    decided.current = true;

    const decision = onboardingDecision({ stored: readOnboarding(), fresh: session.fresh });
    if (decision.kind === 'retire') finishOnboarding();
    if (decision.kind !== 'run') return;

    setDoneDominion(decision.progress.dominion);
    setDoneMalice(decision.progress.malice);
    setCaved(decision.progress.caved);
    setRunning(true);
  }, [session.ready, session.fresh]);

  const stopOnboarding = useCallback(() => {
    finishOnboarding();
    setRunning(false);
  }, []);

  const { state, dispatch } = session;

  /**
   * The beat each track is standing on, whether or not it is the one being shown.
   *
   * **Which beat is on the bar and which beat an action answers are two different
   * questions.** Both tracks are resolved here and the bar picks one below; nothing else
   * may assume the two are the same. A Malice beat gates nothing, so every control stays
   * live while she is talking, and a Dominion beat's gated action performed during her turn
   * has to be recorded — see `acted`.
   *
   * `shownAt` is a ref read during render. That is deliberate and safe here: it holds what was
   * on screen last frame, the game loop re-renders every frame, and its only readers are the
   * latch and the arrival count.
   */
  const openingDone = doneDominion.length > 0;
  const shownId = shownAt.current?.id ?? null;
  const shownAtSmites = shownAt.current?.arrivedAtSmites ?? null;

  const maliceBeat =
    running && openingDone
      ? showingBeat({
          track: onboarding.malice,
          consumed: doneMalice,
          state,
          content,
          shownId: shownId !== null && isMaliceBeatId(shownId) ? shownId : null,
          shownAtSmites,
        })
      : null;
  const dominionBeat = running
    ? showingBeat({
        track: onboarding.dominion,
        consumed: doneDominion,
        state,
        content,
        shownId: shownId !== null && isDominionBeatId(shownId) ? shownId : null,
        shownAtSmites,
      })
    : null;

  /**
   * Which of the two holds the bar.
   *
   * Malice wins once it has started, and holds until it ends. Nothing is lost by making
   * Dominion wait: no Dominion beat carries a retirement window, every one of them is ready
   * off state that does not decay, and its actions are recorded whoever is on the bar.
   * Dominion winning is what cut into her conversation — the track began on a blow struck
   * during the ten-minute opening, got crowded off the bar, and was interrupted by the next
   * Dominion beat coming ready.
   *
   * The exception is the opening beat, which carries the only Skip tutorial and Load save
   * buttons in the game. A player who strikes before rousing anything must not lose their way
   * out for the next minute. That is `openingDone`, above.
   */
  const beat = maliceBeat ?? dominionBeat;

  /**
   * Records an action against every beat it answers, shown or not.
   *
   * A Dominion beat is consulted even while Malice holds the bar. Her beats gate nothing, so
   * the controls a Dominion beat is waiting on stay live throughout her turn, and a player
   * who works one of them has done the thing that beat exists to teach. Consuming a beat
   * they never read is correct: the lesson was learned by doing it. `showingBeat` only ever
   * returns the first unconsumed beat of a track, so the order still holds.
   *
   * Leaving it unrecorded stranded them outright. `appoint` came back ready for a post
   * already filled, and its button is disabled for good once filled — a gate over every
   * other control, with no dismissal, no window and no way out.
   *
   * A dismissal is the one action that does not reach past the bar, and that is the same
   * rule rather than an exception: it is a press on the bar's own button, so the only beat
   * it can answer is the one on the bar. Malice holding the bar means `maliceBeat` is what
   * is on it.
   */
  const acted = useCallback(
    (action: ClearingAction): void => {
      const dismissing = action.kind === 'dismiss';
      const dominionOnTheBar = maliceBeat === null;

      if (dominionBeat && (!dismissing || dominionOnTheBar) && clearsBeat(dominionBeat, action)) {
        setDoneDominion((done) => [...done, dominionBeat.id]);
      }
      if (maliceBeat && clearsBeat(maliceBeat, action)) {
        setDoneMalice((done) => [...done, maliceBeat.id]);
      }
    },
    [dominionBeat, maliceBeat],
  );

  /**
   * Give up on the beat on screen, unread.
   *
   * The beat on the bar, never the other track's — a beat nobody has been shown cannot have
   * stood unanswered. That is why this reads in the same order `beat` does.
   *
   * The consumed id is appended straight to the track's list rather than passed through
   * `acted`. `clearsBeat` answers "did the player do the thing?", and retirement is the
   * case where they did not — routing one through the other silently does nothing for
   * any beat that clears on something other than a dismissal.
   */
  const retire = useCallback((): void => {
    if (maliceBeat) {
      setDoneMalice((done) => [...done, maliceBeat.id]);
      return;
    }
    if (dominionBeat) setDoneDominion((done) => [...done, dominionBeat.id]);
  }, [dominionBeat, maliceBeat]);

  /**
   * Whether the beat standing on the Malice track is superseded by its own successor
   * becoming ready.
   *
   * Read from the track and `doneMalice` directly, not from `maliceBeat` — the handover
   * must fire even while `goad` herself is off screen for her own cooldown, which is the
   * same strike that supersedes her.
   *
   * The stamp goes through because her condition counts caves from her own arrival. Passed the
   * live blow count instead, she could be ended by strikes made during the opening beat, before
   * Malice may take the bar at all — the narrator answering for a conversation nobody had.
   *
   * Only Malice is checked. No Dominion beat declares a supersession condition today, and
   * checking the track anyway would be dead code.
   */
  const handedOver = running
    ? supersededBeat({
        track: onboarding.malice,
        consumed: doneMalice,
        state,
        content,
        shownId: shownId !== null && isMaliceBeatId(shownId) ? shownId : null,
        shownAtSmites,
      })
    : null;

  /**
   * Whether the Dominion beat standing next asks for something already done.
   *
   * Read from the track rather than from `dominionBeat` for the same reason `handedOver` is:
   * this fires precisely while the beat is off the bar. A player who fills the Minion Hand's
   * post while Malice is talking has answered a beat the track has not reached, and without
   * this the track stops on it for good — the post cannot be filled twice, so the beat is
   * never cleared and never ready again.
   *
   * Only Dominion is checked. Every Malice beat gates `none`, so there is no action for one of
   * them to have accomplished, and checking the track anyway would be dead code.
   */
  const accomplished = running
    ? accomplishedBeat({ track: onboarding.dominion, consumed: doneDominion, state, content })
    : null;

  /**
   * The retirement clock, wound on the beat that is actually on screen — and the one place the
   * two consumptions nobody clicked for are recorded, for the same reason: all three are
   * answers to "this beat's time is up" that a component should not decide on its own.
   *
   * The stamp is cleared when nothing is showing and re-taken whenever the showing beat is
   * not the one recorded, so a beat that waited its turn is never handed a timestamp from
   * minutes earlier and retired unread on the frame it arrives. Malice holding the bar makes
   * that queue short, but Dominion still waits behind a beat it did not raise.
   */
  useEffect(() => {
    if (handedOver) {
      // A supersession is the state moving on rather than something the player did, so it is
      // consumed the way `retire()` is. It also means the player took the action the beat was
      // asking for — that is what a supersession condition reads — which is what the verdict
      // needs to know, and what it must not try to work out later from a value that decays.
      //
      // Both appends here are guarded against an id already in the list. These two run from an
      // effect, and StrictMode invokes an effect twice on mount — a duplicate would not be
      // loud, it would quietly put `done` out of reach for good if that were a length check.
      // It is not, any more, but the guard is a line and the class is worth closing at both
      // ends. Returning the same array also spares React the render.
      setDoneMalice((done) => (done.includes(handedOver) ? done : [...done, handedOver]));
      setCaved(true);
    }

    if (accomplished) {
      setDoneDominion((done) => (done.includes(accomplished) ? done : [...done, accomplished]));
    }

    // Both, when a frame produces both. They are consumptions of different tracks and neither
    // is the other's business, so an early return on the first would drop the second — the
    // order they happen to be written in is not a rule anybody should have to know. The clock
    // does not run on such a frame: the beat it would wind is already on its way off the bar.
    if (handedOver || accomplished) return;

    if (!beat) {
      shownAt.current = null;
      return;
    }

    // Arrival. Both counts are taken together, and `arrivedAtSmites` is not written again for
    // as long as this beat holds the bar.
    if (shownAt.current?.id !== beat.id) {
      shownAt.current = {
        id: beat.id,
        arrivedAtSmites: state.stats.smites,
        clockFromMs: state.stats.playTimeMs,
        clockFromSmites: state.stats.smites,
      };
      return;
    }

    // A blow, which restarts the retirement clock and nothing else.
    if (shownAt.current.clockFromSmites !== state.stats.smites) {
      shownAt.current = {
        ...shownAt.current,
        clockFromMs: state.stats.playTimeMs,
        clockFromSmites: state.stats.smites,
      };
      return;
    }

    if (
      shouldRetire({
        beat,
        shownAtMs: shownAt.current.clockFromMs,
        playTimeMs: state.stats.playTimeMs,
      })
    ) {
      retire();
    }
  }, [beat, handedOver, accomplished, state.stats.playTimeMs, state.stats.smites, retire]);

  /**
   * Writes the tracks down on every consumption, not once at the end.
   *
   * An effect over the two lists rather than a call in each handler: retirement, a gated
   * action and a dismissal all consume a beat by appending to one of these, and a fourth
   * way to consume one added later would be written down by this without being told to.
   *
   * Walking the last Dominion beat is finishing, whatever the Malice track still has to
   * say — she is welcome to keep talking for the rest of this session, but a later visit
   * owes the player nothing.
   *
   * "Every id consumed", not a length equality. The two agree only while the list is a set,
   * and two of the four consumption paths now append from an effect. A duplicate would leave
   * the length one over the mark it is compared against and put finishing permanently out of
   * reach — the quiet kind of wrong, on the one flag that decides whether the tutorial ever
   * comes back.
   */
  useEffect(() => {
    if (!running) return;
    writeOnboarding({
      dominion: doneDominion,
      malice: doneMalice,
      caved,
      done: onboarding.dominion.every((beat) => doneDominion.includes(beat.id)),
    });
  }, [running, doneDominion, doneMalice, caved, onboarding.dominion]);

  // Passed only while a beat is showing, so after onboarding the prop is absent and the
  // controls are exactly what they were.
  //
  // The three gated regions are the chain, the muster and the miscreants. The malice
  // panel's ladders take no gate and `GatedControl` has no case for a rung, which holds
  // only because the cheapest climb is 3e6 Evil against a Dominion track that is over in
  // about eleven minutes — the player cannot reach a rung while a beat is still showing.
  // **That rests on a balance number.** Make the first rung cheap enough to reach during
  // the tutorial and a second control goes live beside the gated one, which is the
  // near-tie the accent has no hysteresis to survive. Gate the panel if that number moves.
  const isGated = beat
    ? (control: GatedControl): boolean => isGatedOut(beat.gate, control)
    : undefined;

  /**
   * Whether to draw the eye to the strike.
   *
   * Never struck a blow, and not standing on the opening beat — that beat carries the only way
   * out of the tutorial, and a second thing asking for attention beside it is the near-tie the
   * accent has no hysteresis to survive. It ends itself the first time the button is used and
   * never returns, which is why there is no timer here and nothing random: a random delay in
   * the interface makes a timing-sensitive thing unreproducible exactly where it needs tuning,
   * and it would have no stopping condition.
   */
  const beckon = state.stats.smites === 0 && !(running && doneDominion.length === 0);

  // What the dim frames, and which panel has to be open for it to be framing anything.
  // Null once onboarding is over, which is when the whole thing goes off the screen.
  const spotlight = beat ? spotlightFor(beat) : null;

  // The engine mutates in place, so the state object's identity is stable and this
  // stays the same function for the life of the session. That is what makes the plan
  // below memoise against the version counter rather than against every render.
  const unlocked = useCallback((tierId: TierId): boolean => isTierUnlocked(state, tierId), [state]);

  const appointed = (tierId: TierId): boolean => isAppointed(state, content, tierId);
  const rousable = (tierId: TierId): boolean => isRousable(state, content, tierId);
  // Standing work, not this instant's: owned and unappointed. See ChainStage.
  const needsHand = (tierId: TierId): boolean =>
    !isAppointed(state, content, tierId) && state.gens[tierId].owned.gt(0);

  const plan = useRailPlan({ state, content, quantity, isUnlocked: unlocked }, session.version);

  useEffect(() => {
    if (session.justEarned.length > 0) sound.play('milestone');
  }, [session.justEarned, sound]);

  const prestigeSlot = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  // The reset is on the horizon: a quarter of the way to the first soul, and true for
  // good once it is true. The panel below the deck rides this and so does the notice's
  // row above it — one latch, one moment, and the notice still arrives into a row that
  // has been standing for the three quarters of the road before it. See App.css.
  const prestigeInReach = isPrestigeWorthShowing(state, content);
  // Before the first reset the notice can still arrive, so its row is held. After one it
  // never can, and the row goes with it. See App.css.
  const markerAhead = state.stats.prestiges === 0 && prestigeInReach;
  const showMarker = markerAhead && prestigeGain(state, content).gt(0);

  // jsdom implements neither `scrollIntoView` nor smooth behaviour, so the call is
  // optional rather than guarded by a capability check — the test then exercises the
  // real branch everywhere the real method exists.
  const revealPrestige = (): void => {
    prestigeSlot.current?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  };

  if (!session.ready) return <BootScreen />;

  // The return summary and the title screen are the two things that take the whole screen, and
  // they are mutually exclusive: a session fresh enough for the title screen cannot have an
  // offline report. The summary is checked first anyway, so the rule is enforced rather than
  // trusted — two stacked scrims are darker than either was drawn to be.
  const showTitle = session.fresh && !started && session.offline === null;

  // While either screen is up it *is* the screen. Everything behind it goes inert, so nobody
  // moving through the interface by keyboard lands on a rail they cannot see, and the one
  // primary action is the one on the sheet.
  const screenTaken = session.offline !== null || showTitle;

  const rungs = content.tiers.length;
  const met = content.tiers.filter((tier) => unlocked(tier.id)).length;
  const posts = content.tiers.reduce((total, tier) => total + tier.overseers.length, 0);
  const filled = content.tiers.reduce((total, tier) => total + state.overseers[tier.id].length, 0);
  const ladders = content.smite.upgrades.reduce(
    (total, upgrade) => total + upgrade.rungs.length,
    0,
  );
  const climbed = content.smite.upgrades.reduce(
    (total, upgrade) => total + state.smiteRungs[upgrade.id],
    0,
  );

  const tabs: DeckTab[] = [
    {
      id: 'muster',
      title: copy.rail.title,
      glyph: 'muster',
      trailing: `${met}/${rungs}`,
      ...(plan.best.purchase === null ? {} : { mark: { label: copy.rail.waiting } }),
      panel: (
        <BuyRail
          content={content}
          copy={copy}
          state={state}
          plan={plan}
          quantity={quantity}
          onQuantity={setQuantity}
          isUnlocked={unlocked}
          {...(isGated ? { isGated } : {})}
          onPurchase={(tierId, buying) => {
            const result = dispatch({ kind: 'purchase', tierId, quantity: buying });
            if (!result.ok) return;
            sound.play('purchase');
            acted({ kind: 'buy', tierId });
          }}
        />
      ),
    },
    {
      id: 'miscreants',
      title: copy.overseer.panelTitle,
      glyph: 'miscreants',
      trailing: `${filled}/${posts}`,
      ...(plan.best.appoint === null ? {} : { mark: { label: copy.rail.waiting } }),
      panel: (
        <Miscreants
          content={content}
          copy={copy}
          state={state}
          plan={plan}
          {...(isGated ? { isGated } : {})}
          onAppoint={(overseerId) => {
            const result = dispatch({ kind: 'appoint', overseerId });
            if (!result.ok) return;
            sound.play('unlock');
            acted({ kind: 'appoint', overseerId });
          }}
        />
      ),
    },
    {
      id: 'deeds',
      title: copy.deeds.title,
      glyph: 'deeds',
      trailing: copy.deeds.progress(
        String(state.earnedAchievements.length),
        String(content.achievements.length),
      ),
      panel: <Trophies state={state} content={content} copy={copy.deeds} />,
    },
    {
      id: 'malice',
      title: copy.malice.title,
      glyph: 'malice',
      trailing: `${climbed}/${ladders}`,
      ...(plan.best.climb === null ? {} : { mark: { label: copy.rail.waiting } }),
      panel: (
        <Malice
          content={content}
          state={state}
          plan={plan}
          copy={copy.malice}
          onClimb={(upgradeId) => {
            const result = dispatch({ kind: 'climb', upgradeId });
            if (result.ok) sound.play('purchase');
          }}
          onKeep={(upgradeId) => {
            const result = dispatch({ kind: 'keep', upgradeId });
            if (result.ok) sound.play('unlock');
          }}
        />
      ),
    },
  ];

  return (
    /* The modifier carries the room the pinned prompt stands in, so a player who is not
       being taught anything does not scroll past 16rem of nothing under the footer. It
       is latched, so it changes at most once a session — and only while nothing is
       pinned and the room is below the fold anyway. See App.css. */
    <div className={running ? 'shell shell--onboarding' : 'shell'}>
      <div className="shell__frame" inert={screenTaken}>
        {session.saveRefused && (
          <p className="shell__refusal" role="status">
            {copy.errors.obsoleteSave}
            <button type="button" className="button" onClick={session.dismissRefusal}>
              {copy.close}
            </button>
          </p>
        )}

        <Crown state={state} content={content} copy={copy} />

        <main className="shell__body">
          <ChainStage
            content={content}
            copy={copy}
            state={state}
            version={session.version}
            isUnlocked={unlocked}
            isAppointed={appointed}
            isRousable={rousable}
            needsHand={needsHand}
            {...(isGated ? { isGated } : {})}
            {...(beckon ? { beckon } : {})}
            onRouse={(tierId) => {
              const result = dispatch({ kind: 'rouse', tierId });
              if (!result.ok) return;
              sound.play('rouse');
              acted({ kind: 'rouse', tierId });
            }}
            onSmite={() => {
              const result = dispatch({ kind: 'smite' });
              if (!result.ok) return;
              sound.play('smite');
              acted({ kind: 'smite' });
            }}
          />

          <div className="shell__side">
            {/* The notice's row, held whether or not the notice is showing in it. Souls
                are first owed part-way through a session, so a row that mounted at that
                moment would shove the deck and everything under it down the page — the
                jump `PrestigeLocked` exists to stop, one panel further down. The notice
                is hidden rather than withheld, so the row is exactly as tall as the
                notice at every width, including where it wraps on a phone.

                Held from the horizon rather than from frame one. Permanent, it was 78px
                of nothing under the chain in the opening screen — a fifth of a phone
                fold, for a notice three quarters of the road away. It rides
                `prestigeInReach`, the same latch the panel below the deck rides, the way
                `.shell--onboarding` rides the prompt's. */}
            {markerAhead && (
              <div className="shell__marker" inert={!showMarker}>
                <PrestigeMarker copy={copy.prestige} onReveal={revealPrestige} />
              </div>
            )}

            <Deck tabs={tabs} {...(spotlight?.panel ? { requestOpen: spotlight.panel } : {})} />

            <div ref={prestigeSlot}>
              {prestigeInReach ? (
                <PrestigePanel
                  content={content}
                  copy={copy.prestige}
                  state={state}
                  version={session.version}
                  onPrestige={() => {
                    dispatch({ kind: 'prestige' });
                    sound.play('prestige');
                  }}
                />
              ) : (
                <PrestigeLocked copy={copy.prestige} />
              )}
            </div>
          </div>
        </main>

        {/* Before the prompt's row, so the layer that dims is also earlier in the
            document than the layer that explains it. See App.css.

            Withheld while either screen has taken the whole screen — the return summary
            or the title screen. Both carry a scrim of their own, and two stacked scrims
            are darker than either was drawn to be — it also leaves the prompt bar dimmed
            behind a sheet that has already taken the screen. The lesson comes back the
            moment the sheet goes. */}
        {spotlight && !screenTaken && (
          <Spotlight
            {...(spotlight.target ? { target: spotlight.target } : {})}
            {...(beat?.gate.kind === 'none' ? { weight: 'soft' as const } : {})}
          />
        )}

        {/* Pinned to the foot of the viewport, and mounted only when there is something
            to say. The first instruction of a first run cannot be below the fold, and
            the page is taller than a laptop viewport from the opening frame. Nothing
            moves when it lands or clears: it is out of flow, and the shell reserves the
            room under the footer for as long as onboarding is running. See
            `.shell__prompt`. */}
        {beat && (
          <div className="shell__prompt">
            <Prompt
              line={lineFor({
                copy,
                beatId: beat.id,
                state,
                caved,
                /* The stamp names one beat. Handed to another it would say that beat had
                   been on screen since a blow it was never present for — the same guard
                   `showingBeat` and `supersededBeat` apply to the arrival count. */
                shownAtSmites: shownId === beat.id ? shownAtSmites : null,
              })}
              voice={beat.voice}
              label={
                beat.voice === 'her' ? copy.onboarding.herLabel : copy.onboarding.narratorLabel
              }
              {...(beat.id === 'stir'
                ? {
                    bail: {
                      skip: copy.onboarding.skip,
                      loadSave: copy.onboarding.loadSave,
                      onSkip: stopOnboarding,
                      onLoadSave: () => setLedgerOpen(true),
                    },
                  }
                : {})}
              {...(beat.clearedBy === 'dismiss'
                ? {
                    dismiss: {
                      label: copy.onboarding.dismiss,
                      onDismiss: () => acted({ kind: 'dismiss' }),
                    },
                  }
                : {})}
            />
          </div>
        )}

        <footer className="shell__foot">
          {/* One control, so no landmark around it. The old footer wrapped two in a
              `nav` labelled "Records"; a landmark holding a single named button adds a
              stop to traverse and says nothing the button does not. */}
          <button
            type="button"
            className="button button--quiet"
            aria-haspopup="dialog"
            onClick={() => setLedgerOpen(true)}
          >
            {copy.ledger.title}
          </button>
        </footer>

        <Sheet
          open={ledgerOpen}
          label={copy.ledger.title}
          closeLabel={copy.close}
          onClose={closeLedger}
        >
          <Ledger
            state={state}
            content={content}
            copy={copy.ledger}
            errors={copy.errors}
            soundEnabled={sound.enabled}
            onToggleSound={sound.toggle}
            onExport={session.exportBlob}
            /* A loaded save ends onboarding on the spot. The import swaps the state in
               place with no reload, so without this the opening beat would go on gating
               a mid-game realm down to Rouse Minion — and "Load save" is offered on that
               very beat, so it is the ordinary path, not a corner. */
            onImport={(blob) => {
              const imported = session.importBlob(blob);
              if (imported) stopOnboarding();
              return imported;
            }}
            onAbdicate={session.abdicate}
          />
        </Sheet>

        <DevBar
          content={content}
          state={state}
          onReplace={session.replaceState}
          onOffline={session.simulateOffline}
        />
      </div>

      {session.offline !== null && (
        <OfflineSummary
          report={session.offline}
          content={content}
          copy={copy.offline}
          onDismiss={session.dismissOffline}
        />
      )}

      {showTitle && (
        <TitleScreen title={copy.title} copy={copy.start} onStart={() => setStarted(true)} />
      )}
    </div>
  );
}

/**
 * The line a beat says.
 *
 * Two of the ten are not fixed. `goad` is chosen from the cooldown, from her own arrival and
 * from Apathy, so the prompt moves while the player strikes or ignores her. `verdict` is chosen
 * from how she was consumed, a fact recorded when it happened rather than read back off a
 * decaying value.
 *
 * The three Malice ids are checked before the Dominion lookup, so the fall-through can
 * only be reached by a Dominion id — and because the two unions are disjoint, the
 * typechecker knows it. No cast, and a beat added to either track without copy fails
 * typecheck rather than rendering an empty bar.
 */
function lineFor({
  copy,
  beatId,
  state,
  caved,
  shownAtSmites,
}: {
  copy: Copy;
  beatId: DominionBeatId | MaliceBeatId;
  state: GameState;
  caved: boolean;
  shownAtSmites: number | null;
}): string {
  if (beatId === 'goad') {
    return herLine({
      urging: copy.onboarding.urging,
      waiting: copy.onboarding.waiting,
      state,
      shownAtSmites,
    });
  }
  if (beatId === 'first-blow') return copy.onboarding.malice['first-blow'];
  if (beatId === 'verdict') {
    return caved ? copy.onboarding.malice.verdict.caved : copy.onboarding.malice.verdict.resisted;
  }
  return copy.onboarding.dominion[beatId];
}

/**
 * Held until the save has actually been read, never for a fixed time.
 *
 * A splash on a timer is a lie about progress. This is the shape of the interface
 * that is about to land, so nothing moves when it does.
 */
function BootScreen(): ReactNode {
  return (
    <div className="shell shell--booting" aria-busy="true">
      <div className="boot__crown" />
      <div className="boot__body">
        <div className="boot__stage" />
        <div className="boot__rail" />
      </div>
    </div>
  );
}
