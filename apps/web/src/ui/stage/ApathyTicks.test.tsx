import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CYCLE_SEGMENTS } from '../segments.ts';
import { ApathyTicks } from './ApathyTicks.tsx';

const copy = {
  apathy: 'Apathy',
  bands: ['flinches', 'seen worse', 'stopped looking'] as const,
};

function lit(): number {
  return document.querySelectorAll('.apathy__tick--lit').length;
}

function ticks(): number {
  return document.querySelectorAll('.apathy__tick').length;
}

describe('the apathy ticks', () => {
  it('shows at rest', () => {
    render(<ApathyTicks apathy={0} cap={3} copy={copy} />);

    expect(screen.getByRole('img', { name: /Apathy/ })).toBeInTheDocument();
  });

  it('draws the shared segment count', () => {
    render(<ApathyTicks apathy={0} cap={3} copy={copy} />);

    expect(ticks()).toBe(CYCLE_SEGMENTS);
  });

  it('lights none at rest', () => {
    render(<ApathyTicks apathy={0} cap={3} copy={copy} />);

    expect(lit()).toBe(0);
  });

  it('lights all at the cap', () => {
    render(<ApathyTicks apathy={3} cap={3} copy={copy} />);

    expect(lit()).toBe(CYCLE_SEGMENTS);
  });

  it('lights three at three fifths', () => {
    render(<ApathyTicks apathy={3} cap={5} copy={copy} />);

    expect(lit()).toBe(3);
  });

  it('draws the same count whatever the cap, so raising it moves nothing', () => {
    render(<ApathyTicks apathy={3} cap={6} copy={copy} />);

    expect(ticks()).toBe(CYCLE_SEGMENTS);
  });

  it('reads the share of the cap rather than the count', () => {
    render(<ApathyTicks apathy={3} cap={6} copy={copy} />);

    expect(lit()).toBe(3);
  });

  it('holds a tick until the value drops clear of it', () => {
    render(<ApathyTicks apathy={1} cap={3} copy={copy} />);

    expect(lit()).toBe(2);
  });

  it('holds the top tick just under the cap, where a hammering player lives', () => {
    render(<ApathyTicks apathy={2.56} cap={3} copy={copy} />);

    expect(lit()).toBe(CYCLE_SEGMENTS);
  });

  it('lights the first tick on the least apathy there can be', () => {
    render(<ApathyTicks apathy={0.01} cap={3} copy={copy} />);

    expect(lit()).toBe(1);
  });

  it('names the lowest band at rest', () => {
    render(<ApathyTicks apathy={0} cap={3} copy={copy} />);

    expect(screen.getByRole('img', { name: /flinches/ })).toBeInTheDocument();
  });

  it('names the highest band at the cap', () => {
    render(<ApathyTicks apathy={3} cap={3} copy={copy} />);

    expect(screen.getByRole('img', { name: /stopped looking/ })).toBeInTheDocument();
  });

  it('survives a cap of nothing without dividing by it', () => {
    render(<ApathyTicks apathy={0} cap={0} copy={copy} />);

    expect(lit()).toBe(0);
  });

  it('prints no number', () => {
    render(<ApathyTicks apathy={2} cap={3} copy={copy} />);

    expect(screen.queryByText(/×/)).toBeNull();
  });
});
