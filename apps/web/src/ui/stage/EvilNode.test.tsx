import type { ReactElement } from 'react';
import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it, vi } from 'vitest';
import { setReducedMotion } from '../../../test/setup.ts';
import { EvilNode } from './EvilNode.tsx';

function evil(overrides: Partial<Parameters<typeof EvilNode>[0]> = {}): ReactElement {
  return (
    <EvilNode
      total={new Decimal(4875)}
      name={CURRENT_COPY.evil.name}
      copy={CURRENT_COPY.smite}
      report=""
      isTheAction={false}
      surge={null}
      surgeIndex={8}
      feed={null}
      onSmite={vi.fn()}
      {...overrides}
    />
  );
}

function strike(): HTMLElement {
  return screen.getByRole('button', { name: /^Smite\./ });
}

describe('EvilNode', () => {
  it('shows the total through the shared formatter', () => {
    render(evil());

    expect(screen.getByText('4.88K')).toBeInTheDocument();
  });

  it('makes the total itself the control', () => {
    render(evil());

    expect(strike()).toHaveTextContent('4.88K');
  });

  it('speaks the figure as well as the verb', () => {
    render(evil());

    expect(strike()).toHaveAccessibleName('Smite. You hold 4.88K Evil.');
  });

  it('names the verb in words, not by colour alone', () => {
    render(evil());

    expect(screen.getByText(CURRENT_COPY.smite.action)).toBeInTheDocument();
  });

  it('reports the blow to its caller', async () => {
    const onSmite = vi.fn();
    render(evil({ onSmite }));

    await userEvent.click(strike());

    expect(onSmite).toHaveBeenCalledOnce();
  });

  it('lifts to the accent while nothing else is worth buying', () => {
    render(evil({ isTheAction: true }));

    expect(strike()).toHaveClass('evil-node__strike--lifted');
  });

  it('stays at secondary weight once a purchase is the move', () => {
    render(evil());

    expect(strike()).not.toHaveClass('evil-node__strike--lifted');
  });

  it('holds the report line open before any blow has been struck', () => {
    const { container } = render(evil());

    expect(container.querySelector('.evil-node__report')).toBeEmptyDOMElement();
  });

  it('says what the last blow came to', () => {
    render(evil({ report: 'An orchard, salted.' }));

    expect(screen.getByText('An orchard, salted.')).toBeInTheDocument();
  });

  it('marks the answer arriving when an evocation is under way', () => {
    const { container } = render(evil({ surge: 1 }));

    expect(container.querySelector('.evil-node__answer')).toBeInTheDocument();
  });

  it('delays that mark by the whole length of the wave', () => {
    const { container } = render(evil({ surge: 1 }));

    expect(container.querySelector('.evil-node__answer')?.getAttribute('style')).toContain(
      '--surge-index: 8',
    );
  });

  it('still marks the answer under reduced motion', () => {
    setReducedMotion(true);
    const { container } = render(evil({ surge: 1 }));

    expect(container.querySelector('.evil-node__answer')).toBeInTheDocument();
  });

  it('marks the reduced-motion branch on the node', () => {
    setReducedMotion(true);
    const { container } = render(evil());

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-motion', 'reduced');
  });
});
