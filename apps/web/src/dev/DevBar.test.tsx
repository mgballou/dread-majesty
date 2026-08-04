import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CURRENT, CURRENT_COPY } from '@dm/content';
import { createState, type GameState } from '@dm/engine';
import { DevBar } from './DevBar.tsx';

function mount(overrides: { state?: GameState } = {}) {
  const onReplace = vi.fn();
  const onOffline = vi.fn();

  render(
    <DevBar
      content={CURRENT}
      copy={CURRENT_COPY}
      state={overrides.state ?? createState(CURRENT)}
      onReplace={onReplace}
      onOffline={onOffline}
    />,
  );

  return { onReplace, onOffline, user: userEvent.setup() };
}

describe('DevBar', () => {
  it('says outright that it is not part of the game', () => {
    mount();
    expect(screen.getByText(/not in the production build/i)).toBeInTheDocument();
  });

  it('offers true zero as the first jump', () => {
    mount();
    expect(screen.getByRole('combobox', { name: /jump to/i })).toHaveValue('zero');
  });

  it('hands a freshly built state over when a jump is taken', async () => {
    const { onReplace, user } = mount();

    await user.selectOptions(screen.getByRole('combobox', { name: /jump to/i }), 'banked:10');
    await user.click(screen.getByRole('button', { name: 'Go' }));

    expect(onReplace.mock.calls[0]?.[0].souls.eq(10)).toBe(true);
  });

  it('sets a resource to what was typed', async () => {
    const { onReplace, user } = mount();

    const amount = screen.getByRole('textbox', { name: /amount/i });
    await user.clear(amount);
    await user.type(amount, '1e12');
    await user.click(screen.getByRole('button', { name: 'Set' }));

    expect(onReplace.mock.calls[0]?.[0].resources.evil.eq('1e12')).toBe(true);
  });

  it('never lowers lifetime Evil below what was already earned', async () => {
    const state = createState(CURRENT);
    state.lifetimeEvil = state.lifetimeEvil.add('1e20');
    const { onReplace, user } = mount({ state });

    const amount = screen.getByRole('textbox', { name: /amount/i });
    await user.clear(amount);
    await user.type(amount, '5');
    await user.click(screen.getByRole('button', { name: 'Set' }));

    expect(onReplace.mock.calls[0]?.[0].lifetimeEvil.eq('1e20')).toBe(true);
  });

  it('says so rather than throwing when the amount will not parse', async () => {
    const { onReplace, user } = mount();

    const amount = screen.getByRole('textbox', { name: /amount/i });
    await user.clear(amount);
    await user.type(amount, 'not a number');
    await user.click(screen.getByRole('button', { name: 'Set' }));

    expect(onReplace).not.toHaveBeenCalled();
  });

  it('appoints every Overseer at once', async () => {
    const { onReplace, user } = mount();

    await user.click(screen.getByRole('button', { name: /appoint every overseer/i }));

    expect(onReplace.mock.calls[0]?.[0].overseers.fortress).toEqual([
      'fortress-hand',
      'fortress-goad',
      'fortress-glut',
    ]);
  });

  it('dismisses every Overseer at once', async () => {
    const state = createState(CURRENT);
    state.overseers.minion = ['minion-hand'];
    const { onReplace, user } = mount({ state });

    await user.click(screen.getByRole('button', { name: /dismiss every overseer/i }));

    expect(onReplace.mock.calls[0]?.[0].overseers.minion).toEqual([]);
  });

  it('simulates an absence in whole hours', async () => {
    const { onOffline, user } = mount();

    await user.click(screen.getByRole('button', { name: 'Away 4h' }));

    expect(onOffline).toHaveBeenCalledWith(4 * 60 * 60 * 1000);
  });
});
