import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import type { OfflineReport } from '@dm/engine';
import { describe, expect, it, vi } from 'vitest';
import { OfflineSummary } from './OfflineSummary.tsx';

function report(overrides: Partial<OfflineReport> = {}): OfflineReport {
  return {
    elapsedMs: 8_040_000,
    capped: false,
    coarsened: true,
    produced: { evil: new Decimal(4875), minion: new Decimal(200) },
    ...overrides,
  };
}

describe('OfflineSummary', () => {
  it('names how long the player was away', () => {
    render(
      <OfflineSummary
        report={report()}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/2h 14m/)).toBeInTheDocument();
  });

  it('names one row per tier that produced something', () => {
    render(
      <OfflineSummary
        report={report()}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('says what the tier produced, not merely that it did', () => {
    render(
      <OfflineSummary
        report={report()}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('+4.88K')).toBeInTheDocument();
  });

  it('names the cap when the absence outran it', () => {
    render(
      <OfflineSummary
        report={report({ capped: true })}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(CURRENT_COPY.offline.capped('2h 14m'))).toBeInTheDocument();
  });

  it('says what happens next when nothing happened at all', () => {
    render(
      <OfflineSummary
        report={report({ produced: {} })}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(CURRENT_COPY.offline.nothing)).toBeInTheDocument();
  });

  it('says only how long it was when nothing was produced', () => {
    render(
      <OfflineSummary
        report={report({ produced: {} })}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(CURRENT_COPY.offline.idle('2h 14m'))).toBeInTheDocument();
  });

  it('names the cap on an absence that outran it and produced nothing', () => {
    render(
      <OfflineSummary
        report={report({ produced: {}, capped: true })}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(CURRENT_COPY.offline.idleCapped('2h 14m'))).toBeInTheDocument();
  });

  it('never claims work was done above the line saying nothing happened', () => {
    render(
      <OfflineSummary
        report={report({ produced: {}, capped: true })}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByText(CURRENT_COPY.offline.capped('2h 14m'))).not.toBeInTheDocument();
  });

  it('carries exactly one primary action, and it is the way out', async () => {
    const onDismiss = vi.fn();
    render(
      <OfflineSummary
        report={report()}
        content={CURRENT}
        copy={CURRENT_COPY.offline}
        onDismiss={onDismiss}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.offline.dismiss }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
