import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Deck, type DeckTab } from './Deck.tsx';

const TABS: DeckTab[] = [
  {
    id: 'muster',
    title: 'The Muster',
    glyph: 'muster',
    trailing: '2/4',
    panel: <p>What you raise</p>,
  },
  { id: 'miscreants', title: 'The Miscreants', mark: 'Advised', panel: <p>Who watches</p> },
  { id: 'deeds', title: 'Deeds', panel: <p>What is remembered</p> },
  { id: 'ledger', title: 'The ledger', panel: <p>What is counted</p> },
];

function draw() {
  return { ...render(<Deck tabs={TABS} />), user: userEvent.setup() };
}

describe('Deck', () => {
  it('offers one tab per panel', () => {
    draw();

    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('opens the first panel', () => {
    draw();

    expect(screen.getByRole('tab', { name: /The Muster/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows only the open panel', () => {
    draw();

    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });

  it('names the open panel after the tab that opened it', () => {
    draw();

    expect(screen.getByRole('tabpanel', { name: /The Muster/ })).toBeInTheDocument();
  });

  it('shows the open panel contents', () => {
    draw();

    expect(screen.getByRole('tabpanel')).toHaveTextContent('What you raise');
  });

  it('keeps a shut panel out of the accessibility tree', () => {
    draw();

    expect(screen.queryByRole('tabpanel', { name: /The Miscreants/ })).not.toBeInTheDocument();
  });

  it('changes panel when a tab is pressed', async () => {
    const { user } = draw();

    await user.click(screen.getByRole('tab', { name: /Deeds/ }));

    expect(screen.getByRole('tabpanel', { name: /Deeds/ })).toBeInTheDocument();
  });

  it('shuts the panel the player left', async () => {
    const { user } = draw();

    await user.click(screen.getByRole('tab', { name: /Deeds/ }));

    expect(screen.queryByRole('tabpanel', { name: /The Muster/ })).not.toBeInTheDocument();
  });

  it('keeps one tab stop for the whole strip', () => {
    draw();

    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
  });

  it('moves to the next tab on the right arrow', async () => {
    const { user } = draw();
    await user.click(screen.getByRole('tab', { name: /The Muster/ }));

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /The Miscreants/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('takes focus with it', async () => {
    const { user } = draw();
    await user.click(screen.getByRole('tab', { name: /The Muster/ }));

    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: /The Miscreants/ })).toHaveFocus();
  });

  it('wraps round the end of the strip', async () => {
    const { user } = draw();
    await user.click(screen.getByRole('tab', { name: /The Muster/ }));

    await user.keyboard('{ArrowLeft}');

    expect(screen.getByRole('tab', { name: /The ledger/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('jumps to the last tab on End', async () => {
    const { user } = draw();
    await user.click(screen.getByRole('tab', { name: /The Muster/ }));

    await user.keyboard('{End}');

    expect(screen.getByRole('tabpanel', { name: /The ledger/ })).toBeInTheDocument();
  });

  it('jumps to the first tab on Home', async () => {
    const { user } = draw();
    await user.click(screen.getByRole('tab', { name: /Deeds/ }));

    await user.keyboard('{Home}');

    expect(screen.getByRole('tabpanel', { name: /The Muster/ })).toBeInTheDocument();
  });

  it('says on the tab how far along a panel is', () => {
    draw();

    expect(screen.getByText('2/4')).toBeInTheDocument();
  });

  it('marks a shut panel that has something to act on', () => {
    const { container } = draw();

    expect(container.querySelector('.deck__dot')).toBeInTheDocument();
  });

  it('still says what that mark means, for anyone who cannot see it', () => {
    draw();

    expect(screen.getByRole('tab', { name: /Advised/ })).toBeInTheDocument();
  });

  it('names the open panel under the tube rather than inside it', () => {
    draw();

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('The Muster');
  });

  it('drops that word once the panel is open, because the panel says it', async () => {
    const { user } = draw();

    await user.click(screen.getByRole('tab', { name: /The Miscreants/ }));

    expect(screen.queryByText('Advised')).not.toBeInTheDocument();
  });

  it('lets the open panel be reached without a pointer, because it scrolls', () => {
    draw();

    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');
  });

  it('never spends the accent on a tab', () => {
    const { container } = draw();

    expect(container.querySelectorAll('.button--primary')).toHaveLength(0);
  });

  it('marks exactly one tab as open', () => {
    draw();

    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  });

  it('moves the mark when another tab is chosen', async () => {
    const { user } = draw();

    await user.click(screen.getAllByRole('tab')[2]!);

    expect(screen.getAllByRole('tab')[2]).toHaveAttribute('aria-selected', 'true');
  });
});
