import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Prompt } from './Prompt.tsx';

describe('Prompt', () => {
  it('shows the line it is given', () => {
    render(<Prompt line="Set it about some wickedness." voice="narrator" label="Advice" />);
    expect(screen.getByText('Set it about some wickedness.')).toBeInTheDocument();
  });

  it('names itself to a screen reader', () => {
    render(<Prompt line="A line." voice="narrator" label="Advice" />);
    expect(screen.getByRole('status', { name: 'Advice' })).toBeInTheDocument();
  });

  it('marks her voice on the element', () => {
    render(<Prompt line="Do it again." voice="her" label="She speaks" />);
    expect(screen.getByRole('status')).toHaveClass('prompt--her');
  });

  it('offers no bail actions by default', () => {
    render(<Prompt line="A line." voice="narrator" label="Advice" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onSkip when the player skips', async () => {
    const onSkip = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        bail={{ skip: 'Skip tutorial', loadSave: 'Load save', onSkip, onLoadSave: vi.fn() }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('calls onLoadSave when the player has one to load', async () => {
    const onLoadSave = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        bail={{ skip: 'Skip tutorial', loadSave: 'Load save', onSkip: vi.fn(), onLoadSave }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Load save' }));
    expect(onLoadSave).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when closed by hand', async () => {
    const onDismiss = vi.fn();
    render(
      <Prompt
        line="A line."
        voice="narrator"
        label="Advice"
        dismiss={{ label: 'Understood', onDismiss }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Understood' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
