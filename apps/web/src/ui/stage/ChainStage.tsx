import type { ReactNode } from 'react';
import { ART, type ArtSlot, type Content, type Copy, type TierDef, type TierId } from '@dm/content';
import type { GameState } from '@dm/engine';
import { ChainLink } from './ChainLink.tsx';
import { TierNode, type Feed } from './TierNode.tsx';
import './ChainStage.css';

/** The foot of the chain. Evil is a resource, so it cycles nothing and is always visible. */
const EVIL_ART = 'resource/evil';

/** What the stage and everything it renders reads out of the copy module. */
export type StageScreenCopy = Pick<Copy, 'evil' | 'stage' | 'overseer'>;

interface ChainStageProps {
  content: Content;
  /** The stage's own writing, the manual layer's, and the Evil resource's. */
  copy: StageScreenCopy;
  /**
   * The live state, read strictly as read-only.
   *
   * `step` and `apply` are the only functions permitted to mutate `GameState`
   * (CLAUDE.md, engine rule 2). The stage shows and dispatches; it never writes a
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
   * A predicate rather than a state field, so the stage does not couple to the shape
   * of the unlock bookkeeping.
   */
  isUnlocked: (tierId: TierId) => boolean;
  /** Whether this tier's Overseer is hired, and so it runs without being told. */
  isAppointed: (tierId: TierId) => boolean;
  /** Whether rousing this tier now would start a cycle. */
  isRousable: (tierId: TierId) => boolean;
  /** Start one manual cycle. The only intent the stage sends. */
  onRouse: (tierId: TierId) => void;
}

/**
 * The chain, alive: Fortresses, Dark Legions, Warrens, Minions, Evil, top to bottom.
 *
 * Generators producing other generators is the mechanical novelty of this game, and
 * no other game in the genre draws it. A list would show the same numbers and hide
 * the cascade — here a completion visibly lights the run, pours down it into the node
 * below, and that node marks the arrival and then quickens, because it now has more
 * units turning it.
 *
 * The stage is also where a tier gets roused. The verb belongs on the thing it acts
 * on (spec §6), so the node is the tap target until its Overseer is appointed. That
 * is the only action here, it is never the accent — the rail owns the accent — and
 * every node says in words which of the three states it is in.
 *
 * Untitled on purpose. The stage is the material (ui-sensibility §11), and the
 * material carries no heading of its own; a titled region belongs to whatever is set
 * beside it.
 *
 * Content order is the chain order, expensive rung first. That is how `v1` is
 * authored and how the rail reads it back, and it is why the rung that feeds a node
 * is simply the one before it.
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
}: ChainStageProps): ReactNode {
  const last = content.tiers[content.tiers.length - 1];
  const rungs = climbed(content, isUnlocked);

  return (
    <ol className="stage" role="list" aria-label={copy.stage.chain}>
      {rungs.map((tier, index) => (
        <li className="stage__rung" key={tier.id}>
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
          />
          <ChainLink
            produced={state.gens[tier.id].lifetimeProduced}
            version={version}
            tone={toneOf(tier.art)}
          />
        </li>
      ))}

      <li className="stage__rung" key="evil">
        <TierNode
          name={copy.evil.name}
          art={EVIL_ART}
          count={state.resources.evil}
          cycle={null}
          tone={toneOf(EVIL_ART)}
          isUnlocked
          copy={copy.stage}
          oversight={null}
          feed={feedFrom({ producer: last, state, version })}
        />
      </li>
    </ol>
  );
}

/**
 * The rungs worth drawing: every tier the player has met, and the one above them.
 *
 * The chain used to draw all four from the first frame, which put three identical
 * sealed discs above a single Minion node — the same hole the rail had, and the same
 * answer. One named rung above the climb is a goal. Three are a wall.
 *
 * Content is authored expensive-first, so the met tiers are the tail of the list and
 * the signpost is the one entry before them.
 */
function climbed(content: Content, isUnlocked: (tierId: TierId) => boolean): readonly TierDef[] {
  const met = content.tiers.findIndex((tier) => isUnlocked(tier.id));
  if (met < 0) return content.tiers.slice(-1);
  return content.tiers.slice(Math.max(0, met - 1));
}

/**
 * What a rung is fed by, or null where nothing feeds it.
 *
 * The head of the chain has no rung above it and `noUncheckedIndexedAccess` says so
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
