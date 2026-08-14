import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CURRENT, CURRENT_COPY, CURRENT_ONBOARDING, type TierId } from '@dm/content';
import type { Copy, DominionBeatId, MaliceBeatId } from '@dm/content';
import { isAppointed, isRousable, isTierUnlocked, prestigeGain } from '@dm/engine';
import { useSound } from './audio/useSound.ts';
import { DevBar } from './dev/DevBar.tsx';
import {
  clearsBeat,
  goadLine,
  hasSeenOnboarding,
  isGatedOut,
  markOnboardingSeen,
  showingBeat,
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
   * Onboarding, for a first run and only a first run.
   *
   * Two conditions, and both are needed. `fresh` is this visit: a save on disk means a
   * returning player, whatever they have or have not been told. `hasSeenOnboarding` is
   * every visit before it, and it covers the player who arrived, skipped and closed the
   * tab before the first autosave ten seconds later — `fresh` alone would show it again.
   *
   * Latched into state rather than read every render, so it cannot reappear mid-session.
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
    if (session.fresh && !hasSeenOnboarding()) setRunning(true);
  }, [session.ready, session.fresh]);

  const stopOnboarding = useCallback(() => {
    markOnboardingSeen();
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

  useEffect(() => {
    if (!beat || beat.retireAfterMs === null) return;

    if (shownAt.current?.id !== beat.id) {
      shownAt.current = { id: beat.id, atMs: state.stats.playTimeMs };
      return;
    }

    if (state.stats.playTimeMs - shownAt.current.atMs >= beat.retireAfterMs) {
      acted({ kind: 'dismiss' });
    }
  }, [beat, state.stats.playTimeMs, acted]);

  useEffect(() => {
    if (running && doneDominion.length === onboarding.dominion.length) markOnboardingSeen();
  }, [running, doneDominion.length, onboarding.dominion.length]);

  // Passed only while a beat is showing, so after onboarding the prop is absent and the
  // controls are exactly what they were.
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
            if (result.ok) sound.play('purchase');
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
            if (result.ok) sound.play('unlock');
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
    <div className="shell">
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
              if (result.ok) sound.play('rouse');
              acted({ kind: 'rouse', tierId });
            }}
            onSmite={() => {
              dispatch({ kind: 'smite' });
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

        <div className="shell__prompt">
          {beat && (
            <Prompt
              line={lineFor(copy, beat.id, state.smiteApathy)}
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
          )}
        </div>

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
            onImport={session.importBlob}
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
function lineFor(copy: Copy, beatId: DominionBeatId | MaliceBeatId, apathy: number): string {
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
