import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('the deck and the records', () => {
  it('shows four tabs', async () => {
    render(<App />);

    expect(await screen.findAllByRole('tab')).toHaveLength(4);
  });

  it('carries a wrath tab', async () => {
    render(<App />);

    expect(await screen.findByRole('tab', { name: CURRENT_COPY.wrath.title })).toBeInTheDocument();
  });

  it('carries no ledger tab', async () => {
    render(<App />);
    await screen.findAllByRole('tab');

    expect(screen.queryByRole('tab', { name: CURRENT_COPY.ledger.title })).toBeNull();
  });

  it('reaches the ledger from the footer', async () => {
    render(<App />);

    expect(
      await screen.findByRole('button', { name: CURRENT_COPY.ledger.title }),
    ).toBeInTheDocument();
  });

  it('opens the ledger when the footer button is pressed', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: CURRENT_COPY.ledger.title }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
