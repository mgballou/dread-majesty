import { useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { CURRENT, CURRENT_COPY, type TierId } from '@dm/content';
import { isAppointed, isRousable, isTierUnlocked } from '@dm/engine';
import { useSound } from './audio/useSound.ts';
import { DevBar } from './dev/DevBar.tsx';
import { isPrestigeWorthShowing } from './game/reveals.ts';
import { useGameSession } from './game/useGameSession.ts';
import { Ledger } from './screens/Ledger.tsx';
import { OfflineSummary } from './screens/OfflineSummary.tsx';
import { Trophies } from './screens/Trophies.tsx';
import { Deck, type DeckTab } from './ui/Deck.tsx';
import { formatDuration } from './ui/format.ts';
import { Crown } from './ui/crown/Crown.tsx';
import { BuyRail } from './ui/rail/BuyRail.tsx';
import { Miscreants } from './ui/rail/Miscreants.tsx';
import { PrestigePanel } from './ui/rail/PrestigePanel.tsx';
import { railPlan } from './ui/rail/railPlan.ts';
import { useBuyQuantity } from './ui/rail/useBuyQuantity.ts';
import { ChainStage } from './ui/stage/ChainStage.tsx';
import './App.css';

/**
 * The one screen.
 *
 * The frame persists and nothing here rebuilds to show that it is loading: the stage,
 * the deck and the crown are mounted once and only their contents change. The return
 * summary is an overlay over that frame, never a replacement for it.
 *
 * **One accent, always, and always the right one.** The plan lifts whichever single
 * spend returns the most — a purchase, or the appointment of an Overseer — and when
 * nothing at all is affordable, which is the opening minutes and the moments after a
 * reset, there is no spend to lift, so Smite takes the accent instead.
 *
 * The two spends are drawn in different panels of the deck, and only one panel is open
 * at a time, so the panel holding the lifted spend may well be shut. The shut tab wears
 * the word instead of the accent — navigation is not an action, and an accent on a tab
 * would say "press this" about going somewhere (ui-sensibility §3). One press later the
 * accented control is on screen. The plan is computed here because this is the only
 * place that can see all of it.
 *
 * The prestige panel is still held back rather than shown at zero: a currency at zero
 * with no route to earning any teaches nothing.
 */
export function App(): ReactNode {
  const content = CURRENT;
  const copy = CURRENT_COPY;
  const session = useGameSession(content);
  const sound = useSound();
  // One owner for the setting. It prices every row of the muster and it prices the
  // plan the whole screen is arranged around; two copies of it would drift.
  const { quantity, setQuantity } = useBuyQuantity();

  const { state, dispatch } = session;

  // The engine mutates in place, so the state object's identity is stable and this
  // stays the same function for the life of the session. That is what makes the plan
  // below memoise against the version counter rather than against every render.
  const unlocked = useCallback((tierId: TierId): boolean => isTierUnlocked(state, tierId), [state]);

  const appointed = (tierId: TierId): boolean => isAppointed(state, content, tierId);
  const rousable = (tierId: TierId): boolean => isRousable(state, content, tierId);
  // Standing work, not this instant's: owned and unappointed. See ChainStage.
  const needsHand = (tierId: TierId): boolean =>
    !isAppointed(state, content, tierId) && state.gens[tierId].owned.gt(0);

  const plan = useMemo(
    () => railPlan({ state, content, quantity, isUnlocked: unlocked }),
    [state, content, quantity, unlocked, session.version],
  );

  useEffect(() => {
    if (session.justEarned.length > 0) sound.play('milestone');
  }, [session.justEarned, sound]);

  if (!session.ready) return <BootScreen />;

  // While the return summary is up it is the screen. Everything behind it goes
  // inert, so nobody moving through the interface by keyboard lands on a rail they
  // cannot see, and the one primary action is the one on the sheet.
  const behindTheSummary = session.offline !== null;

  const rungs = content.tiers.length;
  const met = content.tiers.filter((tier) => unlocked(tier.id)).length;
  const posts = content.tiers.reduce((total, tier) => total + tier.overseers.length, 0);
  const filled = content.tiers.reduce((total, tier) => total + state.overseers[tier.id].length, 0);

  const tabs: DeckTab[] = [
    {
      id: 'muster',
      title: copy.rail.title,
      glyph: '⚒',
      trailing: `${met}/${rungs}`,
      ...(plan.best?.kind === 'purchase' ? { mark: copy.rail.best } : {}),
      panel: (
        <BuyRail
          content={content}
          copy={copy}
          state={state}
          plan={plan}
          quantity={quantity}
          onQuantity={setQuantity}
          isUnlocked={unlocked}
          onPurchase={(tierId, buying) => {
            const result = dispatch({ kind: 'purchase', tierId, quantity: buying });
            if (result.ok) sound.play('purchase');
          }}
        />
      ),
    },
    {
      id: 'miscreants',
      title: copy.overseer.panelTitle,
      glyph: '◈',
      trailing: `${filled}/${posts}`,
      ...(plan.best?.kind === 'appoint' ? { mark: copy.rail.best } : {}),
      panel: (
        <Miscreants
          content={content}
          copy={copy}
          state={state}
          plan={plan}
          onAppoint={(overseerId) => {
            const result = dispatch({ kind: 'appoint', overseerId });
            if (result.ok) sound.play('unlock');
          }}
        />
      ),
    },
    {
      id: 'deeds',
      title: copy.deeds.title,
      glyph: '✧',
      trailing: copy.deeds.progress(
        String(state.earnedAchievements.length),
        String(content.achievements.length),
      ),
      panel: <Trophies state={state} content={content} copy={copy.deeds} />,
    },
    {
      id: 'ledger',
      title: copy.ledger.title,
      glyph: '※',
      trailing: formatDuration(state.stats.playTimeMs),
      panel: (
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
            onRouse={(tierId) => {
              const result = dispatch({ kind: 'rouse', tierId });
              if (result.ok) sound.play('rouse');
            }}
            smiteIsTheAction={plan.best === null}
            onSmite={() => {
              dispatch({ kind: 'smite' });
              sound.play('smite');
            }}
          />

          <div className="shell__side">
            <Deck tabs={tabs} />

            {isPrestigeWorthShowing(state, content) && (
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
            )}
          </div>
        </main>

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
