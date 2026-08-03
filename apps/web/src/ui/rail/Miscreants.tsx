import Decimal from 'break_eternity.js';
import { useState, type ReactNode } from 'react';
import type { Content, Copy, TierDef, TierId } from '@dm/content';
import { isAppointed, type GameState } from '@dm/engine';
import { Confirm } from '../Confirm.tsx';
import { formatNumber } from '../format.ts';
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
  onAppoint: (tierId: TierId) => void;
  copy: MiscreantsCopy;
}

interface PostState {
  tier: TierDef;
  filled: boolean;
  /** Null once the post is filled, and for a rung the player has not reached. */
  offer: RailAppointment | null;
  price: Decimal;
  emphasis: SpendEmphasis;
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
 * The mark is a **diamond**, never a circle. Circles are generators, on the chain and
 * in the muster, and a player must be able to tell the two apart before reading a word
 * of either.
 *
 * Pressing a post asks before it spends. Appointing is irreversible and priced against
 * a whole tier of the chain, so it deserves the question — and the sheet is the only
 * place `notes` has ever had room to say who these people are.
 */
export function Miscreants({ content, state, plan, onAppoint, copy }: MiscreantsProps): ReactNode {
  const [asking, setAsking] = useState<TierId | null>(null);

  const offers = new Map<TierId, RailAppointment>();
  for (const option of plan.options) {
    if (option.kind === 'appoint') offers.set(option.tierId, option);
  }

  // Chain order, climbing, so the muster and the miscreants read down the same list.
  const posts: PostState[] = [...content.tiers].reverse().map((tier) => {
    const offer = offers.get(tier.id) ?? null;

    return {
      tier,
      filled: isAppointed(state, tier.id),
      offer,
      price: offer?.cost ?? new Decimal(tier.overseerCost),
      emphasis: spendEmphasis(plan, 'appoint', tier.id),
    };
  });

  const asked = posts.find((post) => post.tier.id === asking) ?? null;

  return (
    <div className="miscreants">
      <ul className="miscreants__posts" aria-label={copy.overseer.panelTitle}>
        {posts.map((post) => (
          <Post key={post.tier.id} post={post} onAsk={() => setAsking(post.tier.id)} copy={copy} />
        ))}
      </ul>

      {asked !== null && (
        <Confirm
          open
          title={copy.overseer.confirmTitle(copy.overseer.names[asked.tier.id])}
          confirmLabel={copy.overseer.confirmAction}
          cancelLabel={copy.overseer.cancel}
          onChoose={(choice) => {
            if (choice === 'confirm') onAppoint(asked.tier.id);
            setAsking(null);
          }}
        >
          <p>{copy.overseer.notes[asked.tier.id]}</p>
          <p>{copy.overseer.cost(formatNumber(asked.price))}</p>
        </Confirm>
      )}
    </div>
  );
}

interface PostProps {
  post: PostState;
  onAsk: () => void;
  copy: MiscreantsCopy;
}

/**
 * One post.
 *
 * The whole entry is the target, because there is nothing else on it to press and a
 * separate button would make the name and the note decoration beside a control. It is
 * dead once the post is filled and dead while the price is out of reach — a control
 * that opens a question it cannot answer is worse than one that plainly will not move.
 */
function Post({ post, onAsk, copy }: PostProps): ReactNode {
  const { tier, filled, offer, price, emphasis } = post;

  return (
    <li className="miscreant" data-tier={tier.id}>
      <button
        type="button"
        className={`miscreant__post miscreant__post--${emphasis}`}
        disabled={offer === null || !offer.affordable}
        aria-haspopup="dialog"
        onClick={onAsk}
      >
        <Diamond filled={filled} />

        <span className="miscreant__body">
          <span className="miscreant__name">{copy.overseer.names[tier.id]}</span>
          <span className="miscreant__note">{copy.overseer.notes[tier.id]}</span>
        </span>

        <span className="miscreant__standing">
          <span className="miscreant__state">{standing(post, copy)}</span>
          {!filled && (
            <span className="miscreant__cost">{copy.overseer.cost(formatNumber(price))}</span>
          )}
          {emphasis !== 'none' && (
            <span className="miscreant__flag">
              {emphasis === 'best' ? copy.rail.best : copy.rail.saving}
            </span>
          )}
        </span>
      </button>
    </li>
  );
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

/** Colour never carries a state alone, so every post says where it stands in a word. */
function standing(post: PostState, copy: MiscreantsCopy): string {
  if (post.filled) return copy.overseer.filled;
  if (post.offer === null || !post.offer.affordable) return copy.overseer.beyond;
  return copy.rail.affordable;
}
