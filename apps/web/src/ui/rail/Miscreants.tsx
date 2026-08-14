import Decimal from 'break_eternity.js';
import { useState, type ReactNode } from 'react';
import type { Content, Copy, OverseerCopy, OverseerDef, OverseerId, TierDef } from '@dm/content';
import { hasPost, type GameState } from '@dm/engine';
import type { GatedControl } from '../../game/onboarding.ts';
import { Banner } from '../Banner.tsx';
import { Confirm } from '../Confirm.tsx';
import { formatNumber, formatWhole } from '../format.ts';
import {
  spendEmphasis,
  type RailAppointment,
  type RailPlan,
  type SpendEmphasis,
} from './railPlan.ts';
import '../controls.css';
import './Miscreants.css';

/** What this panel and everything it renders reads out of the copy module. */
export type MiscreantsCopy = Pick<Copy, 'overseer' | 'rail'>;

interface MiscreantsProps {
  content: Content;
  /** Read-only here, as everywhere outside the engine. */
  state: GameState;
  /** Purchases and appointments on one ranking. Only the appointments are read. */
  plan: RailPlan;
  /**
   * Whether onboarding is holding this control back.
   *
   * A predicate of the same shape as the ones `ChainStage` and `BuyRail` take, so this
   * panel owes nothing to how onboarding decides. Absent means nothing is gated, which
   * is every state of the game after the first run.
   */
  isGated?: (control: GatedControl) => boolean;
  onAppoint: (overseerId: OverseerId) => void;
  copy: MiscreantsCopy;
}

interface PostState {
  tier: TierDef;
  post: OverseerDef;
  filled: boolean;
  /** Null once filled, and for a rung the player has not reached. */
  offer: RailAppointment | null;
  price: Decimal;
  emphasis: SpendEmphasis;
}

interface TierPosts {
  tier: TierDef;
  posts: PostState[];
}

/**
 * The officers: who is watching which part of the realm, and who could be.
 *
 * A sibling of the muster and deliberately not part of it. A generator is a thing you
 * buy again and again; an Overseer is a post you fill once, for ever, and the two
 * decisions read nothing alike. Keeping them on one row taught otherwise, and cost
 * every row of the muster two lines of prose about nobody watching.
 *
 * **Every post shows, filled or not, in reach or not.** A wall of empty posts is the
 * point — it names what is still ahead, which is the same argument the deeds panel
 * makes. It also fixes the panel's height for the whole game, so nothing here moves.
 *
 * **Grouped by tier, three posts each.** A post's price only means anything beside
 * the tier it watches — a Steward and a Taskmaster cost nothing alike, and a flat
 * list of fifteen would read as one undifferentiated wall rather than five choices
 * of three. The tier name is a `Banner` one level below the panel's own title, since
 * this component is already mounted inside the deck's titled region and does not
 * repeat that title itself.
 *
 * The mark is a **diamond**, never a circle. Circles are generators, on the chain and
 * in the muster, and a player must be able to tell the two apart before reading a word
 * of either.
 *
 * Pressing a post asks before it spends. Appointing is irreversible and priced against
 * a whole tier of the chain, so it deserves the question — and the sheet is the only
 * place `notes` has ever had room to say who these people are.
 */
export function Miscreants({
  content,
  state,
  plan,
  isGated,
  onAppoint,
  copy,
}: MiscreantsProps): ReactNode {
  const [asking, setAsking] = useState<OverseerId | null>(null);

  const offers = new Map<OverseerId, RailAppointment>();
  for (const option of plan.options) {
    if (option.kind === 'appoint') offers.set(option.overseerId, option);
  }

  const lifted = liftedAppointment(plan, isGated);

  // Chain order, climbing, so the muster and the miscreants read down the same list.
  const groups: TierPosts[] = [...content.tiers].reverse().map((tier) => ({
    tier,
    posts: tier.overseers.map((post) => {
      const offer = offers.get(post.id) ?? null;

      return {
        tier,
        post,
        filled: hasPost(state, tier.id, post.id),
        offer,
        price: offer?.cost ?? new Decimal(post.cost),
        emphasis: appointEmphasis({ plan, overseerId: post.id, lifted }),
      };
    }),
  }));

  const asked =
    groups.flatMap((group) => group.posts).find((post) => post.post.id === asking) ?? null;

  return (
    <div className="miscreants">
      {groups.map((group) => (
        <section
          key={group.tier.id}
          className="miscreants__group"
          role="group"
          aria-label={group.tier.plural}
        >
          <Banner as="h3" weight="secondary" className="miscreants__label">
            {group.tier.name}
          </Banner>

          <ul className="miscreants__posts">
            {group.posts.map((post) => (
              <Post
                key={post.post.id}
                post={post}
                isGated={isGated?.({ kind: 'appoint', overseerId: post.post.id }) === true}
                onAsk={() => setAsking(post.post.id)}
                copy={copy}
              />
            ))}
          </ul>
        </section>
      ))}

      {asked !== null && (
        <Confirm
          open
          title={copy.overseer.confirmTitle(copy.overseer.names[asked.post.id])}
          confirmLabel={copy.overseer.confirmAction}
          cancelLabel={copy.overseer.cancel}
          onChoose={(choice) => {
            if (choice === 'confirm') onAppoint(asked.post.id);
            setAsking(null);
          }}
        >
          <p>{copy.overseer.notes[asked.post.id]}</p>
          <p>{effectLine(asked.post, copy.overseer)}</p>
          <p>{copy.overseer.cost(formatWhole(asked.price))}</p>
        </Confirm>
      )}
    </div>
  );
}

interface PostProps {
  post: PostState;
  /**
   * True while onboarding is holding this post's appointment back.
   *
   * Resolved by the caller, the same as every other fact on this post — it does not
   * know why, only whether.
   */
  isGated: boolean;
  onAsk: () => void;
  copy: MiscreantsCopy;
}

/**
 * One post.
 *
 * The whole entry is the target, because there is nothing else on it to press and a
 * separate button would make the name and the note decoration beside a control. It is
 * dead once the post is filled, dead while the price is out of reach, and dead while
 * onboarding is holding it back — a control that opens a question it cannot answer is
 * worse than one that plainly will not move.
 */
function Post({ post, isGated, onAsk, copy }: PostProps): ReactNode {
  const { tier, filled, offer, price, emphasis } = post;

  return (
    <li className="miscreant" data-tier={tier.id}>
      <button
        type="button"
        className={`miscreant__post miscreant__post--${emphasis}`}
        disabled={offer === null || !offer.affordable || isGated}
        aria-haspopup="dialog"
        // Read by game/spotlight.ts, which builds a selector string from this value to
        // point the first-run spotlight at a specific post. TypeScript cannot see that
        // dependency, so renaming this attribute loses the spotlight silently. The
        // anchor test in App.test.tsx guards it by walking the shipped tracks and
        // asserting every selector resolves.
        data-overseer={post.post.id}
        onClick={onAsk}
      >
        <Diamond filled={filled} />

        <span className="miscreant__body">
          <span className="miscreant__name">{copy.overseer.names[post.post.id]}</span>
          <span className="miscreant__note">{copy.overseer.notes[post.post.id]}</span>
          <span className="miscreant__effect">{effectLine(post.post, copy.overseer)}</span>
        </span>

        <span className="miscreant__standing">
          <span className="miscreant__state">{standing(post, copy)}</span>
          {!filled && (
            <span className="miscreant__cost">{copy.overseer.cost(formatWhole(price))}</span>
          )}
          {emphasis === 'saving' && <span className="miscreant__flag">{copy.rail.saving}</span>}
        </span>

        {emphasis === 'best' && (
          <span className="miscreant__lifted">{` — ${copy.rail.lifted}`}</span>
        )}
      </button>
    </li>
  );
}

/**
 * Which post's appointment should carry the panel's one accent, gating folded in.
 *
 * Mirrors `liftedPurchase` in `BuyRail.tsx`. `railPlan`'s own `best.appoint` has no
 * idea onboarding exists, so its pick can be the very post a beat is holding back —
 * the thing ui-sensibility §3 forbids, a control wearing the accent that cannot be
 * pressed. When that happens the accent falls to the next affordable, non-gated post
 * by the same score the plan already computed, or to nothing if the gated pick was the
 * only affordable one. `railPlan` itself is untouched; this only re-reads the ranked
 * list it already produced.
 */
function liftedAppointment(
  plan: RailPlan,
  isGated?: (control: GatedControl) => boolean,
): OverseerId | null {
  const best = plan.best.appoint;
  if (best && isGated?.({ kind: 'appoint', overseerId: best.overseerId }) !== true) {
    return best.overseerId;
  }

  let winner: RailAppointment | null = null;
  for (const option of plan.options) {
    if (option.kind !== 'appoint' || !option.affordable) continue;
    if (isGated?.({ kind: 'appoint', overseerId: option.overseerId }) === true) continue;
    if (winner === null || option.score.gt(winner.score)) winner = option;
  }

  return winner?.overseerId ?? null;
}

/**
 * A post's emphasis, with the gate applied. See `purchaseEmphasis` in `BuyRail.tsx`
 * for the reasoning — this is the same shape, one panel over.
 */
function appointEmphasis({
  plan,
  overseerId,
  lifted,
}: {
  plan: RailPlan;
  overseerId: OverseerId;
  lifted: OverseerId | null;
}): SpendEmphasis {
  if (overseerId === lifted) return 'best';
  const emphasis = spendEmphasis(plan, 'appoint', overseerId);
  return emphasis === 'best' ? 'none' : emphasis;
}

interface DiamondProps {
  filled: boolean;
}

/**
 * The mark. A diamond, drawn here rather than taken from the art manifest.
 *
 * The manifest draws the tiers, and the tiers are circles wherever they appear. This
 * is the shape that says "not one of those", so it belongs to the panel that means it.
 */
function Diamond({ filled }: DiamondProps): ReactNode {
  return (
    <svg
      className={`miscreant__mark${filled ? ' miscreant__mark--filled' : ''}`}
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <path className="miscreant__facet" d="M12 1.5 22.5 12 12 22.5 1.5 12Z" />
      {filled && <path className="miscreant__seal" d="M12 7 17 12 12 17 7 12Z" />}
    </svg>
  );
}

/**
 * What a post's effect does, derived from `OverseerDef.effect` rather than authored
 * per post — the mechanical fact is data the content already carries, so a line built
 * from it cannot drift from what the post actually does (spec §7).
 */
function effectLine(post: OverseerDef, copy: OverseerCopy): string {
  switch (post.effect.kind) {
    case 'automate':
      return copy.effect.automate;
    case 'quicken':
      return copy.effect.quicken(formatNumber(new Decimal(post.effect.factor)));
    case 'swell':
      return copy.effect.swell(formatNumber(new Decimal(post.effect.factor)));
  }
}

/**
 * Where a post stands, in a word, or nothing where there is no judgement to report.
 *
 * "Filled" and "Beyond reach" are states worth naming. Open-and-affordable is the
 * default, and a default is not a status (ui-sensibility §12) — the price beside it and
 * the live control are already the whole of what there is to say.
 */
function standing(post: PostState, copy: MiscreantsCopy): string {
  if (post.filled) return copy.overseer.filled;
  if (post.offer === null || !post.offer.affordable) return copy.overseer.beyond;
  return '';
}
