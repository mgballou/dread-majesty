import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it, vi } from 'vitest';
import { QuantityChip } from './QuantityChip.tsx';
import { nextQuantity, previousQuantity } from './quantity.ts';

const copy = CURRENT_COPY.rail;

describe('the quantity cycles', () => {
  it('steps 1 to 10', () => {
    expect(nextQuantity(1)).toBe(10);
  });

  it('steps 100 to max', () => {
    expect(nextQuantity(100)).toBe('max');
  });

  it('wraps max back to 1', () => {
    expect(nextQuantity('max')).toBe(1);
  });

  it('steps backward from 1 to max', () => {
    expect(previousQuantity(1)).toBe('max');
  });
});

describe('the chip', () => {
  it('shows the quantity that is active', () => {
    render(<QuantityChip quantity={100} onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveTextContent('×100');
  });

  it('shows max as a word, not a symbol', () => {
    render(<QuantityChip quantity="max" onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveTextContent('×MAX');
  });

  it('advances on a press', async () => {
    const onChange = vi.fn();
    render(<QuantityChip quantity={10} onChange={onChange} copy={copy} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('goes back on an arrow', async () => {
    const onChange = vi.fn();
    render(<QuantityChip quantity={10} onChange={onChange} copy={copy} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('still advances on Enter', async () => {
    const onChange = vi.fn();
    render(<QuantityChip quantity={10} onChange={onChange} copy={copy} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('still advances on Space', async () => {
    const onChange = vi.fn();
    render(<QuantityChip quantity={10} onChange={onChange} copy={copy} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('says which quantity is set', () => {
    render(<QuantityChip quantity={10} onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/Buy 10 at a time/);
  });

  it('ramps its weight with the quantity', () => {
    render(<QuantityChip quantity="max" onChange={() => {}} copy={copy} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-step', '4');
  });
});
