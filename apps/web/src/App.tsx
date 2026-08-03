import { CURRENT } from '@dm/content';
import { apply, maxAffordable, nextCost, productionPerSecond } from '@dm/engine';
import { useGameLoop } from './game/useGameLoop.ts';
import { formatCount, formatNumber } from './ui/format.ts';
import './App.css';

/**
 * M0 shell. Deliberately not the designed interface.
 *
 * This exists to prove the loop end to end: the engine ticks from real time, the
 * numbers move, purchases apply. The chain diagram and the buy rail described in
 * spec §6 are M2 work and should replace this wholesale.
 */
export function App(): React.ReactElement {
  const content = CURRENT;
  const { state } = useGameLoop(content);

  const evilPerSecond = productionPerSecond(state, content, 'evil');
  const best = bestPurchase();

  function bestPurchase(): string | null {
    for (const tier of [...content.tiers].reverse()) {
      if (maxAffordable(state, content, tier.id) >= 1) return tier.id;
    }
    return null;
  }

  return (
    <main className="shell">
      <header className="crown">
        <p className="crown__evil">{formatNumber(state.resources.evil)}</p>
        <p className="crown__rate">{formatNumber(evilPerSecond)} Evil per second</p>
      </header>

      <section className="rail" aria-label="Generators">
        {[...content.tiers].reverse().map((tier) => {
          const owned = state.gens[tier.id].owned;
          const cost = nextCost(state, content, tier.id);
          const affordable = maxAffordable(state, content, tier.id) >= 1;
          const isBest = best === tier.id;

          return (
            <article key={tier.id} className={`row${isBest ? ' row--best' : ''}`}>
              <div className="row__body">
                <h2 className="row__name">{tier.plural}</h2>
                <p className="row__meta">
                  {formatCount(owned)} owned · {tier.yield} {tier.produces} every{' '}
                  {tier.cycleMs / 1000}s
                </p>
                <progress
                  className="row__cycle"
                  max={tier.cycleMs}
                  value={state.gens[tier.id].progressMs}
                />
              </div>

              <button
                type="button"
                className={isBest ? 'buy buy--primary' : 'buy'}
                disabled={!affordable}
                onClick={() =>
                  apply(state, content, { kind: 'purchase', tierId: tier.id, quantity: 1 })
                }
              >
                {cost ? formatNumber(cost) : '—'}
              </button>
            </article>
          );
        })}
      </section>

      <footer className="foot">
        <button
          type="button"
          className="buy"
          onClick={() => apply(state, content, { kind: 'smite' })}
        >
          Smite
        </button>
        <p className="foot__note">
          M0 shell. The chain diagram and buy rail land in M2 — see the spec.
        </p>
      </footer>
    </main>
  );
}
