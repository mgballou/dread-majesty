import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CURRENT_COPY } from '@dm/content';
import { PrestigeLocked } from './PrestigeLocked.tsx';

describe('PrestigeLocked', () => {
  it('says what to go and do', () => {
    render(<PrestigeLocked copy={CURRENT_COPY.prestige} />);

    expect(screen.getByText('Inflict further suffering.')).toBeInTheDocument();
  });

  it('offers nothing to press', () => {
    render(<PrestigeLocked copy={CURRENT_COPY.prestige} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
