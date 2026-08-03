import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Confirm } from './Confirm.tsx';

function draw(open = true) {
  const onChoose = vi.fn();

  const rendered = render(
    <Confirm
      open={open}
      title="Appoint the Taskmaster of the Pits?"
      confirmLabel="Appoint"
      cancelLabel="Not yet"
      onChoose={onChoose}
    >
      <p>Walks the pits at all hours.</p>
    </Confirm>,
  );

  return { onChoose, rendered, user: userEvent.setup() };
}

describe('Confirm', () => {
  it('stays shut until it is opened', () => {
    draw(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks the question in the caller words', () => {
    draw();

    expect(screen.getByText('Appoint the Taskmaster of the Pits?')).toBeInTheDocument();
  });

  it('shows the body it was handed', () => {
    draw();

    expect(screen.getByText('Walks the pits at all hours.')).toBeInTheDocument();
  });

  it('reports a confirm', async () => {
    const { onChoose, user } = draw();

    await user.click(screen.getByRole('button', { name: 'Appoint' }));

    expect(onChoose).toHaveBeenCalledWith('confirm');
  });

  it('reports a cancel', async () => {
    const { onChoose, user } = draw();

    await user.click(screen.getByRole('button', { name: 'Not yet' }));

    expect(onChoose).toHaveBeenCalledWith('cancel');
  });

  it('reports the confirm once, never a cancel behind it', async () => {
    const { onChoose, user } = draw();

    await user.click(screen.getByRole('button', { name: 'Appoint' }));

    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('does not report a cancel when the caller shuts it after a confirm', async () => {
    const { onChoose, rendered, user } = draw();
    await user.click(screen.getByRole('button', { name: 'Appoint' }));

    rendered.rerender(
      <Confirm
        open={false}
        title="Appoint the Taskmaster of the Pits?"
        confirmLabel="Appoint"
        cancelLabel="Not yet"
        onChoose={onChoose}
      >
        <p>Walks the pits at all hours.</p>
      </Confirm>,
    );

    expect(onChoose).not.toHaveBeenCalledWith('cancel');
  });

  it('gives the confirming action the accent, and only it', () => {
    const { rendered } = draw();

    expect(rendered.baseElement.querySelectorAll('.button--primary')).toHaveLength(1);
  });
});
