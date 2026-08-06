import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT_COPY } from '@dm/content';
import { PrestigeMarker } from './PrestigeMarker.tsx';

describe('PrestigeMarker', () => {
  it('says souls are owed', () => {
    render(<PrestigeMarker copy={CURRENT_COPY.prestige} onReveal={() => {}} />);

    expect(screen.getByText('The realm owes you souls.')).toBeInTheDocument();
  });

  it('leads to the panel when pressed', async () => {
    const onReveal = vi.fn();
    render(<PrestigeMarker copy={CURRENT_COPY.prestige} onReveal={onReveal} />);
    await userEvent.click(screen.getByRole('button', { name: 'Go and count them' }));

    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('never wears the accent, because the stage and the deck already carry one each', () => {
    render(<PrestigeMarker copy={CURRENT_COPY.prestige} onReveal={() => {}} />);

    expect(screen.getByRole('button').className).not.toContain('button--primary');
  });
});
