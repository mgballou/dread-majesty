import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApathyBar } from './ApathyBar.tsx';

const copy = {
  apathy: 'Apathy',
  bands: ['flinches', 'seen worse', 'stopped looking'] as const,
  blow: (multiplier: string) => `Next ${multiplier}`,
};

describe('the apathy gauge', () => {
  it('shows at rest', () => {
    render(<ApathyBar apathy={0} cap={3} blow={2} copy={copy} />);

    expect(screen.getByRole('img', { name: /Apathy/ })).toBeInTheDocument();
  });

  it('reports an empty gauge as empty', () => {
    render(<ApathyBar apathy={0} cap={3} blow={2} copy={copy} />);

    expect(screen.getByRole('img').style.getPropertyValue('--apathy-share')).toBe('0');
  });

  it('reports a full gauge as full', () => {
    render(<ApathyBar apathy={3} cap={3} blow={1} copy={copy} />);

    expect(screen.getByRole('img').style.getPropertyValue('--apathy-share')).toBe('1');
  });

  it('names the lowest band at rest', () => {
    render(<ApathyBar apathy={0} cap={3} blow={2} copy={copy} />);

    expect(screen.getByRole('img', { name: /flinches/ })).toBeInTheDocument();
  });

  it('names the highest band at the cap', () => {
    render(<ApathyBar apathy={3} cap={3} blow={1} copy={copy} />);

    expect(screen.getByRole('img', { name: /stopped looking/ })).toBeInTheDocument();
  });

  it('prints what the next blow is worth', () => {
    render(<ApathyBar apathy={1} cap={3} blow={1.75} copy={copy} />);

    expect(screen.getByText('Next ×1.75')).toBeInTheDocument();
  });

  it('survives a cap of nothing without dividing by it', () => {
    render(<ApathyBar apathy={0} cap={0} blow={2} copy={copy} />);

    expect(screen.getByRole('img').style.getPropertyValue('--apathy-share')).toBe('0');
  });
});
