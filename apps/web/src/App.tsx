import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CURRENT, CURRENT_COPY, CURRENT_ONBOARDING, type TierId } from '@dm/content';
import type { Copy, DominionBeatId, MaliceBeatId } from '@dm/content';
import { isAppointed, isRousable, isTierUnlocked, prestigeGain } from '@dm/engine';
import { useSound } from './audio/useSound.ts';
import { DevBar } from './dev/DevBar.tsx';
import {
  clearsBeat,
  finishOnboarding,
  goadLine,
  isGatedOut,
  onboardingDecision,
  readOnboarding,
  shouldRetire,
  showingBeat,
  writeOnboarding,
  type ClearingAction,
  type GatedControl,
} from './game/onboarding.ts';
import { isPrestigeWorthShowing } from './game/reveals.ts';
import { useGameSession } from './game/useGameSession.ts';
import { Ledger } from './screens/Ledger.tsx';
import { OfflineSummary } from './screens/OfflineSummary.tsx';
import { Trophies } from './screens/Trophies.tsx';
import { Deck, type DeckTab } from './ui/Deck.tsx';
import { Prompt } from './ui/Prompt.tsx';
import { Sheet } from './ui/Sheet.tsx';
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
  const [doneDominion, setDoneDominion] = useState<readonly DominionBeatId[]>([]);
  const [doneMalice, setDoneMalice] = useState<readonly MaliceBeatId[]>([]);
  /** Play time at which the beat on screen appeared, for the retirement clock. */
  const shownAt = useRef<{ id: string; atMs: number } | null>(null);

  useEffect(() => {
    if (!session.ready || decided.current) return;
    decided.current = true;

    const decision = onboardingDecision({ stored: readOnboarding(), fresh: session.fresh });
    if (decision.kind === 'retire') finishOnboarding();
    if (decision.kind !== 'run') return;

    setDoneDominion(decision.progress.dominion);
    setDoneMalice(decision.progress.malice);
    setRunning(true);
  }, [session.ready, session.fresh]);

  const stopOnboarding = useCallback(() => {
    finishOnboarding();
    setRunning(false);
  }, []);

  const { state, dispatch } = session;

  // How many bands the Apathy gauge is drawn in. Read from the copy rather than fixed at
  // three, so the beat that waits for "the realm has stopped looking" and the gauge that
  // says it can never disagree about where that band starts.
  const bandCount = copy.smite.bands.length;

  const dominionBeat = running
    ? showingBeat({ track: onboarding.dominion, consumed: doneDominion, state, content, bandCount })
    : null;
  const maliceBeat =
    running && dominionBeat === null
      ? showingBeat({ track: onboarding.malice, consumed: doneMalice, state, content, bandCount })
      : null;
  const beat = dominionBeat ?? maliceBeat;

  const acted = useCallback(
    (action: ClearingAction): void => {
      if (dominionBeat && clearsBeat(dominionBeat, action)) {
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
   * The consumed id is appended straight to the track's list rather than passed through
   * `acted`. `clearsBeat` answers "did the player do the thing?", and retirement is the
   * case where they did not — routing one through the other silently does nothing for
   * any beat that clears on something other than a dismissal.
   */
  const retire = useCallback((): void => {
    if (dominionBeat) {
      setDoneDominion((done) => [...done, dominionBeat.id]);
      return;
    }
    if (maliceBeat) setDoneMalice((done) => [...done, maliceBeat.id]);
  }, [dominionBeat, maliceBeat]);

  /**
   * The retirement clock, wound on the beat that is actually on screen.
   *
   * The stamp is cleared when nothing is showing and re-taken whenever the showing beat
   * is not the one recorded. Both matter: Dominion takes the bar from Malice mid-track,
   * and a stale stamp would leave the crowded-out beat holding a timestamp from minutes
   * earlier, to be retired unread on the frame it came back.
   */
  useEffect(() => {
    if (!beat) {
      shownAt.current = null;
      return;
    }

    if (shownAt.current?.id !== beat.id) {
      shownAt.current = { id: beat.id, atMs: state.stats.playTimeMs };
      return;
    }

    if (
      shouldRetire({ beat, shownAtMs: shownAt.current.atMs, playTimeMs: state.stats.playTimeMs })
    ) {
      retire();
    }
  }, [beat, state.stats.playTimeMs, retire]);

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
   */
  useEffect(() => {
    if (!running) return;
    writeOnboarding({
      dominion: doneDominion,
      malice: doneMalice,
      done: doneDominion.length === onboarding.dominion.length,
    });
  }, [running, doneDominion, doneMalice, onboarding.dominion.length]);

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
  // Before the first reset the notice can still arrive, so its row is held from the
  // first frame. After one it never can, and the row goes with it. See App.css.
  const markerAhead = state.stats.prestiges === 0;
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

  // While the return summary is up it is the screen. Everything behind it goes
  // inert, so nobody moving through the interface by keyboard lands on a rail they
  // cannot see, and the one primary action is the one on the sheet.
  const behindTheSummary = session.offline !== null;

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
      <div className="shell__frame" inert={behindTheSummary}>
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
                notice at every width, including where it wraps on a phone. */}
            {markerAhead && (
              <div className="shell__marker" inert={!showMarker}>
                <PrestigeMarker copy={copy.prestige} onReveal={revealPrestige} />
              </div>
            )}

            <Deck tabs={tabs} />

            <div ref={prestigeSlot}>
              {isPrestigeWorthShowing(state, content) ? (
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

        {/* Pinned to the foot of the viewport, and mounted only when there is something
            to say. The first instruction of a first run cannot be below the fold, and
            the page is taller than a laptop viewport from the opening frame. Nothing
            moves when it lands or clears: it is out of flow, and the shell reserves the
            room under the footer for as long as onboarding is running. See
            `.shell__prompt`. */}
        {beat && (
          <div className="shell__prompt">
            <Prompt
              line={lineFor({ copy, beatId: beat.id, apathy: state.smiteApathy })}
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
    </div>
  );
}

/**
 * The line a beat says.
 *
 * `goad` is the only beat whose line is not fixed — hers is chosen from Apathy as it
 * bleeds, so the prompt mutates while the player resists and she works down her own
 * argument. Every other beat has exactly one line.
 *
 * The three Malice ids are checked before the Dominion lookup, so the fall-through can
 * only be reached by a Dominion id — and because the two unions are disjoint, the
 * typechecker knows it. No cast, and a beat added to either track without copy fails
 * typecheck rather than rendering an empty bar.
 */
function lineFor({
  copy,
  beatId,
  apathy,
}: {
  copy: Copy;
  beatId: DominionBeatId | MaliceBeatId;
  apathy: number;
}): string {
  if (beatId === 'goad') return goadLine(copy.onboarding.goad, apathy);
  if (beatId === 'first-blow') return copy.onboarding.malice['first-blow'];
  if (beatId === 'apathy') return copy.onboarding.malice.apathy;
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
