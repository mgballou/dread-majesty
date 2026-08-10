import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY, TOUR_STEP_IDS } from '@dm/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App.tsx';
import { markTourSeen, forgetTour } from '../game/tour.ts';
import { TOUR_ANCHORS, Tour } from './Tour.tsx';

const copy = CURRENT_COPY.tour;

function walk(onFinish = vi.fn()): typeof onFinish {
  render(<Tour copy={copy} anchors={{}} onFinish={onFinish} />);
  return onFinish;
}

afterEach(() => forgetTour());

describe('the tour', () => {
  it('opens on the first step', () => {
    walk();

    expect(screen.getByRole('heading', { name: copy.steps.premise.title })).toBeInTheDocument();
  });

  it('names itself to a screen reader', () => {
    walk();

    expect(screen.getByRole('dialog')).toHaveAccessibleName(copy.label);
  });

  it('says where the player stands', () => {
    walk();

    expect(
      screen.getByText(copy.progress({ step: '1', of: String(TOUR_STEP_IDS.length) })),
    ).toBeInTheDocument();
  });

  it('offers no way back on the first step', () => {
    walk();

    expect(screen.queryByRole('button', { name: copy.back })).toBeNull();
  });

  it('advances to the second step', async () => {
    walk();
    await userEvent.click(screen.getByRole('button', { name: copy.next }));

    expect(screen.getByRole('heading', { name: copy.steps.evil.title })).toBeInTheDocument();
  });

  it('goes back again', async () => {
    walk();
    await userEvent.click(screen.getByRole('button', { name: copy.next }));
    await userEvent.click(screen.getByRole('button', { name: copy.back }));

    expect(screen.getByRole('heading', { name: copy.steps.premise.title })).toBeInTheDocument();
  });

  it('reaches the last step', async () => {
    walk();
    for (let i = 1; i < TOUR_STEP_IDS.length; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: copy.next }));
    }

    expect(screen.getByRole('heading', { name: copy.steps.cascade.title })).toBeInTheDocument();
  });

  it('closes the last step with the finishing word, not the advancing one', async () => {
    walk();
    for (let i = 1; i < TOUR_STEP_IDS.length; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: copy.next }));
    }

    expect(screen.getByRole('button', { name: copy.done })).toBeInTheDocument();
  });

  it('reports finishing when the last step is closed', async () => {
    const onFinish = walk();
    for (let i = 1; i < TOUR_STEP_IDS.length; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: copy.next }));
    }
    await userEvent.click(screen.getByRole('button', { name: copy.done }));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('reports finishing when skipped from the first step', async () => {
    const onFinish = walk();
    await userEvent.click(screen.getByRole('button', { name: copy.skip }));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('offers a way out on every step', async () => {
    walk();
    for (let i = 1; i < TOUR_STEP_IDS.length; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: copy.next }));
      expect(screen.getByRole('button', { name: copy.skip })).toBeInTheDocument();
    }
  });
});

describe('every step the tour walks', () => {
  it('carries copy for each id', () => {
    expect(Object.keys(copy.steps)).toHaveLength(TOUR_STEP_IDS.length);
  });

  it.each(TOUR_STEP_IDS)('gives %s a title and a body', (id) => {
    expect(copy.steps[id].body.length).toBeGreaterThan(0);
  });
});

describe('the anchors the tour points at', () => {
  it.each(Object.entries(TOUR_ANCHORS))(
    'resolves %s in the rendered game',
    async (_id, selector) => {
      markTourSeen();
      render(<App />);
      await screen.findAllByRole('tab');

      expect(document.querySelector(selector)).not.toBeNull();
    },
  );
});
