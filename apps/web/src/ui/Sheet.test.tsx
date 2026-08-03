import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet.tsx';

function mount(open: boolean) {
  const onClose = vi.fn();

  const rendered = render(
    <Sheet open={open} label="The Ledger" closeLabel="Close" onClose={onClose}>
      <p>Lifetime Evil</p>
    </Sheet>,
  );

  return { onClose, rendered, user: userEvent.setup() };
}

describe('Sheet', () => {
  it('stays shut until it is opened', () => {
    mount(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a dialog', () => {
    mount(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('takes its name from the label', () => {
    mount(true);
    expect(screen.getByRole('dialog', { name: 'The Ledger' })).toBeInTheDocument();
  });

  it('shows what it was given', () => {
    mount(true);
    expect(screen.getByText('Lifetime Evil')).toBeInTheDocument();
  });

  it('tells the parent when it closes', async () => {
    const { onClose, user } = mount(true);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shuts when the parent says so', () => {
    const { rendered, onClose } = mount(true);

    rendered.rerender(
      <Sheet open={false} label="The Ledger" closeLabel="Close" onClose={onClose}>
        <p>Lifetime Evil</p>
      </Sheet>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
