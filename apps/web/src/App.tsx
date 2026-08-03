import { useCallback, useEffect, useState } from 'react';
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
import { Sheet } from './ui/Sheet.tsx';
import { Crown } from './ui/crown/Crown.tsx';
import { BuyRail } from './ui/rail/BuyRail.tsx';
import { PrestigePanel } from './ui/rail/PrestigePanel.tsx';
import { railPlan } from './ui/rail/railPlan.ts';
import { useBuyQuantity } from './ui/rail/useBuyQuantity.ts';
import { ChainStage } from './ui/stage/ChainStage.tsx';
import './App.css';

type Reveal = 'trophies' | 'ledger' | null;

/**
 * The one screen.
 *
 * The frame persists and nothing here rebuilds to show that it is loading: the
 * stage, the rail and the crown are mounted once and only their contents change.
 * The records and the return summary are overlays over that frame, never
 * replacements for it.
 *
 * **One accent, always, and always the right one.** The rail lifts whichever single
 * spend returns the most — a purchase, or the appointment of an Overseer — and when
 * nothing at all is affordable, which is the opening minutes and the moments after a
 * reset, there is no spend to lift, so Smite takes the accent instead. The two are
 * coordinated here because this is the only place that can see both.
 *
 * Two things are held back rather than shown at zero. The prestige panel waits until
 * souls are within reach (`isPrestigeWorthShowing`), and the records sit behind the
 * footer, because a currency at zero with no route to earning any teaches nothing.
 */
export function App(): ReactNode {
  const content = CURRENT;
  const copy = CURRENT_COPY;
  const session = useGameSession(content);
  const sound = useSound();
  const { quantity } = useBuyQuantity();

  const [reveal, setReveal] = useState<Reveal>(null);
  const closeReveal = useCallback((): void => setReveal(null), []);

  const { state, dispatch } = session;
  const unlocked = (tierId: TierId): boolean => isTierUnlocked(state, tierId);
  const appointed = (tierId: TierId): boolean => isAppointed(state, tierId);
  const rousable = (tierId: TierId): boolean => isRousable(state, tierId);

  const plan = railPlan({ state, content, quantity, isUnlocked: unlocked });

  useEffect(() => {
    if (session.justEarned.length > 0) sound.play('milestone');
  }, [session.justEarned, sound]);

  if (!session.ready) return <BootScreen />;

  // While the return summary is up it is the screen. Everything behind it goes
  // inert, so nobody moving through the interface by keyboard lands on a rail they
  // cannot see, and the one primary action is the one on the sheet.
  const behindTheSummary = session.offline !== null;

  return (
    <div className="shell">
      <div className="shell__frame" inert={behindTheSummary}>
        <Crown
          state={state}
          content={content}
          copy={copy}
          smiteIsTheAction={plan.best === null}
          onSmite={() => {
            dispatch({ kind: 'smite' });
            sound.play('smite');
          }}
        />

        <main className="shell__body">
          <ChainStage
            content={content}
            copy={copy}
            state={state}
            version={session.version}
            isUnlocked={unlocked}
            isAppointed={appointed}
            isRousable={rousable}
            onRouse={(tierId) => {
              const result = dispatch({ kind: 'rouse', tierId });
              if (result.ok) sound.play('rouse');
            }}
          />

          <div className="shell__side">
            <BuyRail
              content={content}
              copy={copy}
              state={state}
              version={session.version}
              isUnlocked={unlocked}
              onPurchase={(tierId, buying) => {
                const result = dispatch({ kind: 'purchase', tierId, quantity: buying });
                if (result.ok) sound.play('purchase');
              }}
              onAppoint={(tierId) => {
                const result = dispatch({ kind: 'appoint', tierId });
                if (result.ok) sound.play('unlock');
              }}
            />

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

        <footer className="shell__foot">
          <nav className="shell__records" aria-label="Records">
            <button
              type="button"
              className="button button--quiet"
              aria-haspopup="dialog"
              onClick={() => setReveal('trophies')}
            >
              {copy.deeds.title}
            </button>
            <button
              type="button"
              className="button button--quiet"
              aria-haspopup="dialog"
              onClick={() => setReveal('ledger')}
            >
              {copy.ledger.title}
            </button>
          </nav>
        </footer>

        <Sheet
          open={reveal === 'trophies'}
          label={copy.deeds.title}
          closeLabel={copy.close}
          onClose={closeReveal}
        >
          <Trophies state={state} content={content} copy={copy.deeds} />
        </Sheet>

        <Sheet
          open={reveal === 'ledger'}
          label={copy.ledger.title}
          closeLabel={copy.close}
          onClose={closeReveal}
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
          copy={copy}
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
