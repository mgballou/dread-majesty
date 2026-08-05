import type { ReactElement } from 'react';
import Decimal from 'break_eternity.js';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState } from '@dm/engine';
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
      phase={{ kind: 'ready', share: 0 }}
      content={CURRENT}
      state={createState(CURRENT)}
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

  it('is lifted whenever the blow is ready', () => {
    const { container } = render(evil({ phase: { kind: 'ready', share: 0 } }));

    expect(container.querySelector('.evil-node__strike--lifted')).not.toBeNull();
  });

  it('is not lifted while it is cooling', () => {
    const { container } = render(evil({ phase: { kind: 'cooling', share: 0.4 } }));

    expect(container.querySelector('.evil-node__strike--lifted')).toBeNull();
  });

  it('is not lifted while it is running', () => {
    const { container } = render(evil({ phase: { kind: 'active', share: 0.2 } }));

    expect(container.querySelector('.evil-node__strike--lifted')).toBeNull();
  });

  it('holds the report line open before any blow has been struck', () => {
    const { container } = render(evil());

    expect(container.querySelector('.evil-node__report')).toBeEmptyDOMElement();
  });

  it('says what the last blow came to', () => {
    render(evil({ report: 'An orchard, salted.' }));

    expect(screen.getByText('An orchard, salted.')).toBeInTheDocument();
  });

  it('says the verb while it is ready', () => {
    render(evil());

    expect(screen.getByText(CURRENT_COPY.smite.action)).toBeInTheDocument();
  });

  it('says the surge while the buff runs', () => {
    render(evil({ phase: { kind: 'active', share: 0.5 } }));

    expect(screen.getByText(CURRENT_COPY.smite.surging)).toBeInTheDocument();
  });

  it('says it is coming while it is spent', () => {
    render(evil({ phase: { kind: 'cooling', share: 0.5 } }));

    expect(screen.getByText(CURRENT_COPY.smite.cooling)).toBeInTheDocument();
  });

  it('puts no number on the control, whatever state it is in', () => {
    render(evil({ phase: { kind: 'cooling', share: 0.5 } }));

    expect(strike().textContent).not.toMatch(/\ds/);
  });

  it('refuses to be struck while cooling', () => {
    render(evil({ phase: { kind: 'cooling', share: 0.5 } }));

    expect(strike()).toBeDisabled();
  });

  it('marks which part of the blow it is in, for the stylesheet', () => {
    const { container } = render(evil({ phase: { kind: 'active', share: 1 } }));

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-smite', 'active');
  });

  it('marks the reduced-motion branch on the node', () => {
    setReducedMotion(true);
    const { container } = render(evil());

    expect(container.querySelector('.evil-node')).toHaveAttribute('data-motion', 'reduced');
  });
});
