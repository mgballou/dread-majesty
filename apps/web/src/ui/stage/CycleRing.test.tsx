import { render, screen } from '@testing-library/react';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { CycleRing } from './CycleRing.tsx';

describe('CycleRing', () => {
  it('reads as empty at the start of a cycle', () => {
    render(<CycleRing progressMs={0} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('reads as half swept part-way through a cycle', () => {
    render(
      <CycleRing progressMs={12_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('reads as full at completion', () => {
    render(
      <CycleRing progressMs={24_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('closes the sweep entirely at completion', () => {
    const { container } = render(
      <CycleRing progressMs={24_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    const sweep = container.querySelector('.stage-ring__sweep');
    const [lit] = (sweep?.getAttribute('stroke-dasharray') ?? '').split(' ');
    expect(Number(lit)).toBeCloseTo(2 * Math.PI * 21, 3);
  });

  it('carries a text alternative naming what is cycling', () => {
    render(
      <CycleRing progressMs={12_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      CURRENT_COPY.stage.cycle({ label: 'Minions', swept: '50%' }),
    );
  });

  it('takes its name from the tier it belongs to', () => {
    render(<CycleRing progressMs={0} cycleMs={24_000} label="Warrens" copy={CURRENT_COPY.stage} />);

    expect(screen.getByRole('progressbar', { name: 'Warrens' })).toBeInTheDocument();
  });

  it('holds at zero when the cycle has no length', () => {
    render(<CycleRing progressMs={5_000} cycleMs={0} label="Minions" copy={CURRENT_COPY.stage} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('sweeps continuously when motion is unrestricted', () => {
    render(
      <CycleRing progressMs={10_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  });

  it('jumps to the step below when motion is reduced', () => {
    setReducedMotion(true);

    render(
      <CycleRing progressMs={10_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('still reports the cycle under reduced motion rather than dropping it', () => {
    setReducedMotion(true);

    render(
      <CycleRing progressMs={24_000} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('says which motion branch it drew', () => {
    setReducedMotion(true);

    render(<CycleRing progressMs={0} cycleMs={24_000} label="Minions" copy={CURRENT_COPY.stage} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-motion', 'reduced');
  });

  it('sweeps a fifth of the circumference at a fifth of the cycle', () => {
    const { container } = render(
      <CycleRing progressMs={800} cycleMs={4000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    const sweep = container.querySelector('.stage-ring__sweep');
    const [lit] = (sweep?.getAttribute('stroke-dasharray') ?? '').split(' ');
    expect(Number(lit)).toBeCloseTo((2 * Math.PI * 21) / 5, 3);
  });

  it('cuts the ring into five', () => {
    const { container } = render(
      <CycleRing progressMs={0} cycleMs={4000} label="Minions" copy={CURRENT_COPY.stage} />,
    );

    const divisions = container.querySelector('.stage-ring__divisions');
    const [, run] = (divisions?.getAttribute('stroke-dasharray') ?? '').split(' ');
    expect(Number(run)).toBeCloseTo((2 * Math.PI * 21) / 5 - 3, 3);
  });
});
