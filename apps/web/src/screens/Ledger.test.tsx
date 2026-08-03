import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
import { describe, expect, it, vi } from 'vitest';
import { Ledger } from './Ledger.tsx';

function harness(overrides: Partial<Parameters<typeof Ledger>[0]> = {}) {
  const state = createState(CURRENT);
  state.lifetimeEvil = new Decimal(4875);
  state.stats.smites = 12;

  const props = {
    state,
    content: CURRENT,
    copy: CURRENT_COPY.ledger,
    errors: CURRENT_COPY.errors,
    soundEnabled: false,
    onToggleSound: vi.fn(),
    onExport: vi.fn(() => 'a-blob'),
    onImport: vi.fn(() => true),
    onAbdicate: vi.fn(),
    ...overrides,
  };

  render(<Ledger {...props} />);
  return props;
}

describe('Ledger', () => {
  it('shows lifetime Evil through the shared formatter', () => {
    harness();

    expect(screen.getByText('4.88K')).toBeInTheDocument();
  });

  it('names the state of the sound toggle', () => {
    harness({ soundEnabled: true });

    expect(screen.getByRole('button', { name: CURRENT_COPY.ledger.soundOn })).toBeInTheDocument();
  });

  it('will not import until there is something to import', () => {
    harness();

    expect(screen.getByRole('button', { name: CURRENT_COPY.ledger.importAction })).toBeDisabled();
  });

  it('reads the save out on export', async () => {
    harness();

    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.ledger.exportAction }));

    expect(screen.getByLabelText(CURRENT_COPY.ledger.blobLabel)).toHaveValue('a-blob');
  });

  it('says so when a blob will not load', async () => {
    harness({ onImport: vi.fn(() => false) });
    await userEvent.type(screen.getByLabelText(CURRENT_COPY.ledger.blobLabel), 'rubbish');

    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.ledger.importAction }));

    expect(screen.getByRole('status')).toHaveTextContent(CURRENT_COPY.errors.corruptSave);
  });

  it('does not abdicate without asking first', async () => {
    const props = harness();

    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.ledger.abdicate }));

    expect(props.onAbdicate).not.toHaveBeenCalled();
  });

  it('names what abdication costs before it happens', async () => {
    harness();

    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.ledger.abdicate }));

    expect(screen.getByRole('dialog')).toHaveTextContent(CURRENT_COPY.ledger.abdicateBody);
  });
});
