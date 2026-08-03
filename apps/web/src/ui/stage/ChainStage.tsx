import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ART, type ArtSlot, type Content, type Copy, type TierDef, type TierId } from '@dm/content';
import type { GameState } from '@dm/engine';
import { ChainLink } from './ChainLink.tsx';
import { EvilNode, EVIL_ART } from './EvilNode.tsx';
import { TierNode, type Feed } from './TierNode.tsx';
import './ChainStage.css';

/**
 * How long an evocation lasts before the chain forgets it.
 *
 * Long enough for the call to reach the far end and the answer to come back at the
 * step the stylesheet uses, plus one beat. It is also what holds the mark on screen
 * under reduced motion, where nothing animates and the tint simply waits out the
 * window instead.
 */
const SURGE_MS = 900;

/** What the chain and everything it draws reads out of the copy module. */
export type StageScreenCopy = Pick<Copy, 'evil' | 'stage' | 'overseer' | 'smite'>;

interface ChainStageProps {
  content: Content;
  /** The chain's writing, the manual layer's, the verb's, and the Evil resource's. */
  copy: StageScreenCopy;
  /**
   * The live state, read strictly as read-only.
   *
   * `step` and `apply` are the only functions permitted to mutate `GameState`
   * (CLAUDE.md, engine rule 2). The chain shows and dispatches; it never writes a
   * field.
   */
  state: GameState;
  /**
   * Bumps whenever the state moved.
   *
   * `state` is mutated in place, so its identity never changes and this is what a
   * render hangs on. The links and the nodes compare against it rather than running a
   * clock.
   */
  version: number;
  /**
   * Whether the player has met a tier.
   *
   * A predicate rather than a state field, so the chain does not couple to the shape
   * of the unlock bookkeeping.
   */
  isUnlocked: (tierId: TierId) => boolean;
  /** Whether this tier's Overseer is hired, and so it runs without being told. */
  isAppointed: (tierId: TierId) => boolean;
  /** Whether rousing this tier now would start a cycle. */
  isRousable: (tierId: TierId) => boolean;
  /** Start one manual cycle. */
  onRouse: (tierId: TierId) => void;
  /** True while nothing on the rail is worth buying, which is when evoking is the move. */
  smiteIsTheAction: boolean;
  /** Evoke. The chain runs the wave; the caller credits the Evil. */
  onSmite: () => void;
}

/**
 * The chain, alive, running left to right: Fortresses, Dark Legions, Warrens, Minions,
 * and Evil at the end of it.
 *
 * Generators producing other generators is the mechanical novelty of this game, and no
 * other game in the genre draws it. A list would show the same numbers and hide the
 * cascade — here a completion visibly lights the run, pours along it into the node
 * after it, and that node marks the arrival and then quickens, because it now has more
 * units turning it.
 *
 * **The generators scroll; Evil does not.** The rungs sit in a track that runs off the
 * end as the chain grows, and the track anchors itself on the highest tier that still
 * needs rousing, so the rung wanting a tap is the one at the left edge and the ones
 * that run themselves drift out of the way. Evil is pinned outside the track, because
 * it is the control and a control that can be scrolled off the screen is a bug.
 *
 * **Evoking.** Pressing Evil sends a call out along the chain, rung by rung, and the
 * answer runs back down the runs to land on Evil. Every beat of it is a delay computed
 * here and handed to the stylesheet as `--surge-index`, so the CSS stays dumb and the
 * order of the wave lives in one place.
 *
 * Rousing lives on the rungs. The verb belongs on the thing it acts on (spec §6), so a
 * rung is the tap target until its Overseer is appointed. Neither verb is ever the
 * accent — the rail owns that — and every node says in words which state it is in.
 *
 * Untitled on purpose. The chain is the material (ui-sensibility §11), and the material
 * carries no heading of its own.
 */
export function ChainStage({
  content,
  copy,
  state,
  version,
  isUnlocked,
  isAppointed,
  isRousable,
  onRouse,
  smiteIsTheAction,
  onSmite,
}: ChainStageProps): ReactNode {
  const rungs = climbed(content, isUnlocked);
  const last = content.tiers[content.tiers.length - 1];

  const [surge, setSurge] = useState<number | null>(null);
  const struck = useRef(0);

  useEffect(() => {
    if (surge === null) return undefined;
    const timer = setTimeout(() => setSurge(null), SURGE_MS);
    return () => clearTimeout(timer);
  }, [surge]);

  const track = useAnchoredOnWork(rungs, isRousable);

  // The wave, in beats. The call runs out from Evil, so the rung nearest it lights
  // first; the answer runs back along the runs, so the run furthest out lights first.
  const beats = rungs.length;

  return (
    <section className="stage" aria-label={copy.stage.chain}>
      <ol className="stage__track" role="list" ref={track}>
        {rungs.map((tier, index) => (
          <li className="stage__rung" key={tier.id} data-tier={tier.id}>
            <TierNode
              name={tier.plural}
              art={tier.art}
              count={state.gens[tier.id].owned}
              cycle={{ progressMs: state.gens[tier.id].progressMs, cycleMs: tier.cycleMs }}
              tone={toneOf(tier.art)}
              isUnlocked={isUnlocked(tier.id)}
              copy={copy.stage}
              oversight={{
                isAppointed: isAppointed(tier.id),
                isRousable: isRousable(tier.id),
                overseer: copy.overseer.names[tier.id],
                copy: copy.overseer,
                onRouse: () => onRouse(tier.id),
              }}
              feed={feedFrom({ producer: rungs[index - 1], state, version })}
              surge={surge}
              surgeIndex={beats - 1 - index}
            />
            <ChainLink
              produced={state.gens[tier.id].lifetimeProduced}
              version={version}
              tone={toneOf(tier.art)}
              surge={surge}
              surgeIndex={beats + index}
            />
          </li>
        ))}
      </ol>

      <EvilNode
        total={state.resources.evil}
        name={copy.evil.name}
        copy={copy.smite}
        report={report(state, copy.smite.results)}
        isTheAction={smiteIsTheAction}
        surge={surge}
        surgeIndex={beats * 2}
        feed={feedFrom({ producer: last, state, version })}
        onSmite={() => {
          struck.current += 1;
          setSurge(struck.current);
          onSmite();
        }}
      />
    </section>
  );
}

/**
 * What the last blow came to.
 *
 * Chosen by the smite count rather than at random: the engine forbids `Math.random`
 * and there is no reason for the interface to hold a different standard. Cycling also
 * means a player who taps ten times sees ten different lines rather than the same one
 * twice by chance.
 */
function report(state: GameState, results: readonly string[]): string {
  if (state.stats.smites === 0 || results.length === 0) return '';
  return results[(state.stats.smites - 1) % results.length] ?? '';
}

/**
 * Keeps the rung that wants a tap at the left edge of the track.
 *
 * Overseers are bought from the bottom of the chain upward, so the tiers still needing
 * a hand are the dear ones — and those are the ones on the left. As the cheap end
 * automates it simply runs off the right-hand side, which is what the track is for.
 *
 * Inert where the track fits, which is the desktop case and every test, since a runner
 * measures everything as zero.
 */
function useAnchoredOnWork(
  rungs: readonly TierDef[],
  isRousable: (tierId: TierId) => boolean,
): React.RefObject<HTMLOListElement | null> {
  const track = useRef<HTMLOListElement>(null);

  // Falls back to the head of the chain, never to wherever the browser last left the
  // scroll. With nothing to rouse there is no work to point at, and the top of the
  // chain is the thing worth looking at — not the cheap end that runs itself.
  const wants = rungs.find((tier) => isRousable(tier.id))?.id ?? rungs[0]?.id ?? null;

  useEffect(() => {
    const element = track.current;
    if (!element || wants === null) return;
    if (element.scrollWidth <= element.clientWidth) return;
    if (typeof element.scrollTo !== 'function') return;

    const rung = element.querySelector(`[data-tier="${wants}"]`);
    if (!(rung instanceof HTMLElement)) return;

    element.scrollTo({ left: rung.offsetLeft, behavior: 'smooth' });
  }, [wants]);

  return track;
}

/**
 * The rungs worth drawing: every tier the player has met, and the one above them.
 *
 * The chain used to draw all four from the first frame, which put three identical
 * sealed discs beside a single Minion node — the same hole the rail had, and the same
 * answer. One named rung ahead of the climb is a goal. Three are a wall.
 *
 * Content is authored expensive-first, which is also left-to-right here, so the met
 * tiers are the tail of the list and the signpost is the one entry before them.
 */
function climbed(content: Content, isUnlocked: (tierId: TierId) => boolean): readonly TierDef[] {
  const met = content.tiers.findIndex((tier) => isUnlocked(tier.id));
  if (met < 0) return content.tiers.slice(-1);
  return content.tiers.slice(Math.max(0, met - 1));
}

/**
 * What a rung is fed by, or null where nothing feeds it.
 *
 * The head of the chain has no rung before it and `noUncheckedIndexedAccess` says so
 * at the index, which is the whole reason this takes a possibly-absent tier rather
 * than an id.
 */
function feedFrom({
  producer,
  state,
  version,
}: {
  producer: TierDef | undefined;
  state: GameState;
  version: number;
}): Feed | null {
  if (!producer) return null;
  return { produced: state.gens[producer.id].lifetimeProduced, version };
}

/** Tone rides with the data: the manifest names the slot's token and nothing else does. */
function toneOf(slot: string): ArtSlot['fallback']['tone'] | null {
  return ART[slot]?.fallback.tone ?? null;
}

export { EVIL_ART };
