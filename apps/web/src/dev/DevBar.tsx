import { useMemo, useState, type ReactNode } from 'react';
import Decimal from 'break_eternity.js';
import { RESOURCE_IDS, TIER_IDS, type Content, type Copy, type TierId } from '@dm/content';
import { cloneState, type GameState } from '@dm/engine';
import { jumps, type Jump } from './jumps.ts';
import './DevBar.css';

const HOUR = 60 * 60 * 1000;

/** How long an absence each away button simulates, in hours. */
const AWAY_HOURS = [1, 4, 24] as const;

interface DevBarProps {
  content: Content;
  copy: Copy;
  state: GameState;
  /** Swaps a freshly built state in, over the boundary an imported save crosses. */
  onReplace: (next: GameState) => void;
  /** Runs `catchUp` for the given elapsed time and raises the return summary. */
  onOffline: (elapsedMs: number) => void;
}

/**
 * The workbench. Not part of the game.
 *
 * It exists so a change to the opening loop can be checked in ten seconds rather
 * than two hours, and it is **stripped from production builds** — `import.meta.env.DEV`
 * is replaced by `false` at build time and everything below this line falls out with
 * it. The guard sits here rather than at the call site so it cannot be forgotten.
 *
 * It deliberately looks nothing like the rest of the interface: monospace, unstyled
 * controls, hard rules, no gold. Nothing here should ever be mistaken for the game,
 * and dressing a debug tool up is how it ends up shipped.
 *
 * Verified stripped: no string from this file or from `jumps.ts` survives `pnpm
 * build`. About a kilobyte of `DevBar.css` does, because Vite collects stylesheets
 * from the module graph before the JavaScript is tree-shaken. Left alone on purpose —
 * the rules can never match, and the alternative is lazy-loading the panel through
 * `Suspense` to save a kilobyte off a development tool.
 */
export function DevBar(props: DevBarProps): ReactNode {
  return import.meta.env.DEV ? <DevPanel {...props} /> : null;
}

function DevPanel({ content, copy, state, onReplace, onOffline }: DevBarProps): ReactNode {
  const list = useMemo(() => jumps(content, copy), [content, copy]);
  const first = list[0];

  const [jumpId, setJumpId] = useState(first?.id ?? '');
  const [target, setTarget] = useState('resource:evil');
  const [amount, setAmount] = useState('1e6');
  const [note, setNote] = useState('');

  const groups = useMemo(() => groupBy(list), [list]);

  function go(): void {
    const jump = list.find((candidate) => candidate.id === jumpId);
    if (!jump) return;
    onReplace(jump.build());
    setNote(jump.label);
  }

  function set(): void {
    // `new Decimal('rubbish')` does not throw — it returns NaN. Both have to be
    // caught or a typo silently sets a resource to NaN and the run is unrecoverable.
    let value: Decimal;
    try {
      value = new Decimal(amount);
    } catch {
      value = new Decimal(NaN);
    }

    if (value.isNan() || !value.isFinite()) {
      setNote(`Cannot read "${amount}" as a number`);
      return;
    }

    const next = cloneState(state);
    const [kind, id] = target.split(':');

    if (kind === 'resource' && id === 'evil') {
      next.resources.evil = value;
      // Lifetime never goes down: the prestige formula reads it and a jump that
      // lowered it would be inventing a state the game cannot reach.
      next.lifetimeEvil = Decimal.max(next.lifetimeEvil, value);
    } else if (kind === 'tier' && isTier(id)) {
      next.gens[id].owned = value;
      next.unlocked[id] = value.gt(0);
    } else if (kind === 'souls') {
      next.souls = value;
    } else {
      setNote(`Nothing called "${target}"`);
      return;
    }

    onReplace(next);
    setNote(`${target} set to ${value.toString()}`);
  }

  function overseers(appointed: boolean): void {
    const next = cloneState(state);
    for (const id of TIER_IDS) next.overseers[id] = appointed;
    onReplace(next);
    setNote(appointed ? 'Every Overseer appointed' : 'Every Overseer dismissed');
  }

  function away(hours: number): void {
    onOffline(hours * HOUR);
    setNote(`Simulated ${hours}h away`);
  }

  return (
    <aside className="devbar" aria-label="Development controls">
      <p className="devbar__banner">
        DEV ONLY — not in the production build
        {note !== '' && <span className="devbar__note"> · {note}</span>}
      </p>

      <div className="devbar__row">
        <label className="devbar__field">
          <span>Jump to</span>
          <select value={jumpId} onChange={(event) => setJumpId(event.target.value)}>
            {[...groups].map(([group, entries]) => (
              <optgroup key={group} label={group}>
                {entries.map((jump) => (
                  <option key={jump.id} value={jump.id}>
                    {jump.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button type="button" onClick={go}>
          Go
        </button>
      </div>

      <div className="devbar__row">
        <label className="devbar__field">
          <span>Set</span>
          <select value={target} onChange={(event) => setTarget(event.target.value)}>
            {RESOURCE_IDS.map((id) => (
              <option key={id} value={`resource:${id}`}>
                {id}
              </option>
            ))}
            {TIER_IDS.map((id) => (
              <option key={id} value={`tier:${id}`}>
                {id}
              </option>
            ))}
            <option value="souls:souls">souls</option>
          </select>
        </label>
        <label className="devbar__field">
          <span>to</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            spellCheck={false}
            aria-label="Amount"
          />
        </label>
        <button type="button" onClick={set}>
          Set
        </button>
      </div>

      <div className="devbar__row">
        <button type="button" onClick={() => overseers(true)}>
          Appoint every Overseer
        </button>
        <button type="button" onClick={() => overseers(false)}>
          Dismiss every Overseer
        </button>
        {AWAY_HOURS.map((hours) => (
          <button key={hours} type="button" onClick={() => away(hours)}>
            Away {hours}h
          </button>
        ))}
      </div>
    </aside>
  );
}

function groupBy(list: readonly Jump[]): Map<string, Jump[]> {
  const groups = new Map<string, Jump[]>();
  for (const jump of list) {
    const entries = groups.get(jump.group);
    if (entries) entries.push(jump);
    else groups.set(jump.group, [jump]);
  }
  return groups;
}

function isTier(id: string | undefined): id is TierId {
  return id !== undefined && (TIER_IDS as readonly string[]).includes(id);
}
