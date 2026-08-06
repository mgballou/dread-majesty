import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CYCLE_SEGMENTS } from '../segments.ts';
import { ApathyArc } from './ApathyArc.tsx';

describe('ApathyArc', () => {
  it('draws one segment per cycle segment', () => {
    const { container } = render(<ApathyArc apathy={0} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('lights nothing at rest', () => {
    const { container } = render(<ApathyArc apathy={0} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(0);
  });

  it('is mounted at rest, so nothing moves when it fills', () => {
    const { container } = render(<ApathyArc apathy={0} cap={3} />);

    expect(container.querySelector('.apathy')).not.toBeNull();
  });

  it('holds the top segment just under the cap, where a hammering player lives', () => {
    const { container } = render(<ApathyArc apathy={2.56} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('lights every segment at the cap', () => {
    const { container } = render(<ApathyArc apathy={3} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('lights one segment just above rest', () => {
    const { container } = render(<ApathyArc apathy={0.01} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(1);
  });

  it('clamps a value above the cap rather than overdrawing', () => {
    const { container } = render(<ApathyArc apathy={99} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(CYCLE_SEGMENTS);
  });

  it('reads empty rather than dividing by a cap of zero', () => {
    const { container } = render(<ApathyArc apathy={1} cap={0} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(0);
  });

  it('is hidden from assistive tech, because the control it sits in carries the words', () => {
    render(<ApathyArc apathy={1} cap={3} />);

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('holds a segment until the value drops clear of it', () => {
    const { container } = render(<ApathyArc apathy={1} cap={3} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(2);
  });

  it('reads the share of the cap rather than the count', () => {
    const { container } = render(<ApathyArc apathy={3} cap={5} />);

    expect(container.querySelectorAll('.apathy__segment--lit')).toHaveLength(3);
  });
});
