import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CURRENT_COPY } from '@dm/content';
import { describe, expect, it, vi } from 'vitest';
import { TitleScreen } from './TitleScreen.tsx';

describe('TitleScreen', () => {
  it('names the game, the lede and the premise', () => {
    render(<TitleScreen title={CURRENT_COPY.title} copy={CURRENT_COPY.start} onStart={vi.fn()} />);

    expect(screen.getByText(CURRENT_COPY.title)).toBeInTheDocument();
    expect(screen.getByText(CURRENT_COPY.start.lede)).toBeInTheDocument();
    expect(screen.getByText(CURRENT_COPY.start.premise)).toBeInTheDocument();
  });

  it('carries exactly one action, and it is the way in', async () => {
    const onStart = vi.fn();
    render(<TitleScreen title={CURRENT_COPY.title} copy={CURRENT_COPY.start} onStart={onStart} />);

    await userEvent.click(screen.getByRole('button', { name: CURRENT_COPY.start.begin }));

    expect(onStart).toHaveBeenCalledOnce();
  });

  it('holds focus on the one action from the first frame', () => {
    render(<TitleScreen title={CURRENT_COPY.title} copy={CURRENT_COPY.start} onStart={vi.fn()} />);

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: CURRENT_COPY.start.begin }),
    );
  });

  it('exposes a modal dialog named by its heading', () => {
    render(<TitleScreen title={CURRENT_COPY.title} copy={CURRENT_COPY.start} onStart={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: CURRENT_COPY.title })).toBeInTheDocument();
  });
});
