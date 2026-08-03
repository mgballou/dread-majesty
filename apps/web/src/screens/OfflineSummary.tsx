import type { ReactNode } from 'react';
import type Decimal from 'break_eternity.js';
import type { Content, Copy, ProducibleId, TierDef } from '@dm/content';
import type { OfflineReport } from '@dm/engine';
import { TierArt } from '../ui/art/TierArt.tsx';
import { formatDuration, formatNumber } from '../ui/format.ts';
import './OfflineSummary.css';

interface OfflineSummaryProps {
  report: OfflineReport;
  content: Content;
  copy: Copy['offline'];
  onDismiss: () => void;
}

/**
 * What happened while you were away.
 *
 * A screen, not a toast. This is the reward for coming back, and a line that fades
 * after four seconds throws away the only moment the cascade is legible as a whole
 * — the player sees one figure per tier and can read the chain off it. One primary
 * action, and it is the way out.
 */
export function OfflineSummary({
  report,
  content,
  copy,
  onDismiss,
}: OfflineSummaryProps): ReactNode {
  const rows = ledger(report, content);
  const span = formatDuration(report.elapsedMs);

  return (
    <div className="return" role="dialog" aria-modal="true" aria-labelledby="return-title">
      <div className="return__sheet">
        <header className="return__head">
          <h1 className="return__title" id="return-title">
            {copy.heading}
          </h1>
          <p className="return__span">{report.capped ? copy.capped(span) : copy.summary(span)}</p>
        </header>

        {rows.length === 0 ? (
          <p className="return__nothing">{copy.nothing}</p>
        ) : (
          <ul className="return__ledger">
            {rows.map(({ tier, amount }) => (
              <li className="return__row" key={tier.id}>
                <TierArt slot={tier.art} size={28} decorative />
                <span className="return__source">{tier.plural}</span>
                <span className="return__amount">+{formatNumber(amount)}</span>
                <span className="return__unit">{label(content, tier.produces)}</span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="button button--primary return__resume" onClick={onDismiss}>
          {copy.dismiss}
        </button>
      </div>
    </div>
  );
}

interface LedgerRow {
  tier: TierDef;
  amount: Decimal;
}

/** One row per tier that actually did something. A tier that did nothing says nothing. */
function ledger(report: OfflineReport, content: Content): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const tier of content.tiers) {
    const amount = report.produced[tier.produces];
    if (amount && amount.gt(0)) rows.push({ tier, amount });
  }
  return rows;
}

function label(content: Content, producible: ProducibleId): string {
  return content.tiers.find((tier) => tier.id === producible)?.plural ?? 'Evil';
}
