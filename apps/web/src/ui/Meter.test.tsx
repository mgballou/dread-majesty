import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setReducedMotion } from '../../test/setup.ts';
import { Meter } from './Meter.tsx';

function swept(): string {
  return screen.getByRole('progressbar').style.getPropertyValue('--meter-swept');
}

describe('Meter', () => {
  it('is a progressbar to assistive technology', () => {
    render(<Meter label="Minion cycle" value={0} max={24_000} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('takes its accessible name from the label', () => {
    render(<Meter label="Minion cycle" value={0} max={24_000} />);

    expect(screen.getByRole('progressbar', { name: 'Minion cycle' })).toBeInTheDocument();
  });

  it('reports the fraction as a percentage', () => {
    render(<Meter label="Minion cycle" value={12_000} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('reports the bounds it measures against', () => {
    render(<Meter label="Minion cycle" value={12_000} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
  });

  it('reports an empty bar when nothing has run', () => {
    render(<Meter label="Minion cycle" value={0} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps a value past the maximum', () => {
    render(<Meter label="Minion cycle" value={90_000} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps a value below zero', () => {
    render(<Meter label="Minion cycle" value={-500} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('reads a maximum of zero as empty rather than as an error', () => {
    render(<Meter label="Minion cycle" value={100} max={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('sweeps the fill under full motion', () => {
    render(<Meter label="Minion cycle" value={7_000} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-motion', 'full');
  });

  it('fills to the exact fraction under full motion', () => {
    render(<Meter label="Minion cycle" value={7_000} max={28_000} />);

    expect(swept()).toBe('25%');
  });

  it('jumps the fill under reduced motion', () => {
    setReducedMotion(true);

    render(<Meter label="Minion cycle" value={7_000} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-motion', 'reduced');
  });

  it('snaps the fill to a step under reduced motion', () => {
    setReducedMotion(true);

    render(<Meter label="Minion cycle" value={10_000} max={24_000} />);

    expect(swept()).toBe('40%');
  });

  it('still reports the exact value under reduced motion', () => {
    setReducedMotion(true);

    render(<Meter label="Minion cycle" value={10_000} max={24_000} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });

  it('still draws the fill under reduced motion', () => {
    setReducedMotion(true);

    const { container } = render(<Meter label="Minion cycle" value={10_000} max={24_000} />);

    expect(container.querySelector('.meter__fill')).toBeInTheDocument();
  });

  it('still draws the track under reduced motion', () => {
    setReducedMotion(true);

    const { container } = render(<Meter label="Minion cycle" value={10_000} max={24_000} />);

    expect(container.querySelector('.meter__teeth')).toBeInTheDocument();
  });

  it('reaches a full bar at the maximum', () => {
    render(<Meter label="Minion cycle" value={24_000} max={24_000} />);

    expect(swept()).toBe('100%');
  });

  it('carries a layout class from the caller alongside its own', () => {
    render(<Meter label="Minion cycle" value={0} max={24_000} className="rail__cycle" />);

    expect(screen.getByRole('progressbar')).toHaveClass('rail__cycle');
  });

  it('reports the exact fraction under full motion', () => {
    render(<Meter label="Minion cycle" value={37} max={100} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37');
  });

  it('drops to whole segments under reduced motion', () => {
    setReducedMotion(true);

    render(<Meter label="Minion cycle" value={37} max={100} />);

    expect(swept()).toBe('20%');
  });
});
