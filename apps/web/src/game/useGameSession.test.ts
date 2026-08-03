import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import Decimal from 'break_eternity.js';
import { act, renderHook, waitFor } from '@testing-library/react';
import { CURRENT } from '@dm/content';
import { createState, serialize } from '@dm/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave, readSave, writeSave } from './storage.ts';
import { useGameSession } from './useGameSession.ts';

const TEN_MINUTES = 600_000;

beforeEach(async () => {
  await clearSave();
  vi.spyOn(Date, 'now').mockReturnValue(TEN_MINUTES);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function appointed() {
  const state = createState(CURRENT);
  state.overseers.minion = true;
  return state;
}

async function ready() {
  const rendered = renderHook(() => useGameSession(CURRENT));
  await waitFor(() => expect(rendered.result.current.ready).toBe(true));
  return rendered;
}

describe('useGameSession', () => {
  it('gets past the boot screen under the double mount StrictMode performs', async () => {
    const { result } = renderHook(() => useGameSession(CURRENT), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.ready).toBe(true));
  });

  it('reads the save exactly once under the double mount', async () => {
    await writeSave(serialize(createState(CURRENT), 0));
    const reads = vi.spyOn(indexedDB, 'open');

    const { result } = renderHook(() => useGameSession(CURRENT), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('holds until the save has been read', () => {
    const { result } = renderHook(() => useGameSession(CURRENT));

    expect(result.current.ready).toBe(false);
  });

  it('reports no absence for a player who has never played', async () => {
    const { result } = await ready();

    expect(result.current.offline).toBeNull();
  });

  it('does not interrupt for a gap shorter than the floor', async () => {
    await writeSave(serialize(appointed(), TEN_MINUTES - 9_000));

    const { result } = await ready();

    expect(result.current.offline).toBeNull();
  });

  it('still catches a short gap up, it just says nothing about it', async () => {
    await writeSave(serialize(appointed(), TEN_MINUTES - 9_000));

    const { result } = await ready();

    expect(result.current.state.resources.evil.gte(5)).toBe(true);
  });

  it('interrupts once the gap reaches the floor', async () => {
    await writeSave(serialize(appointed(), TEN_MINUTES - 120_000));

    const { result } = await ready();

    expect(result.current.offline?.elapsedMs).toBe(120_000);
  });

  it('catches up the time between the save and the return', async () => {
    await writeSave(serialize(createState(CURRENT), 0));

    const { result } = await ready();

    expect(result.current.offline?.elapsedMs).toBe(TEN_MINUTES);
  });

  it('credits what was produced during the absence', async () => {
    const away = appointed();
    away.gens.minion.owned = new Decimal(10);
    await writeSave(serialize(away, 0));

    const { result } = await ready();

    expect(result.current.offline?.produced.evil?.gt(0)).toBe(true);
  });

  it('credits nothing to a tier nobody oversees', async () => {
    const away = createState(CURRENT);
    away.gens.minion.owned = new Decimal(10);
    await writeSave(serialize(away, 0));

    const { result } = await ready();

    expect(result.current.offline?.produced.evil).toBeUndefined();
  });

  it('restores the counts the save was holding', async () => {
    const away = createState(CURRENT);
    away.gens.warren.owned = new Decimal(4);
    await writeSave(serialize(away, 0));

    const { result } = await ready();

    expect(result.current.state.gens.warren.owned.gte(4)).toBe(true);
  });

  it('drops the absence summary once dismissed', async () => {
    await writeSave(serialize(createState(CURRENT), 0));
    const { result } = await ready();

    act(() => result.current.dismissOffline());

    expect(result.current.offline).toBeNull();
  });

  it('applies an intent and moves the state on', async () => {
    const { result } = await ready();

    act(() => void result.current.dispatch({ kind: 'smite' }));

    expect(result.current.state.stats.smites).toBe(1);
  });

  it('round-trips its own exported blob', async () => {
    const { result } = await ready();
    act(() => void result.current.dispatch({ kind: 'smite' }));
    const blob = result.current.exportBlob();

    act(() => void result.current.importBlob(blob));

    expect(result.current.state.stats.smites).toBe(1);
  });

  it('refuses a blob that is not a save', async () => {
    const { result } = await ready();

    expect(result.current.importBlob('nonsense')).toBe(false);
  });

  it('writes the save down when it is torn down', async () => {
    const rendered = await ready();

    rendered.unmount();

    await waitFor(async () => expect(await readSave()).not.toBeNull());
  });

  it('records what the returning player had already earned', async () => {
    const away = createState(CURRENT);
    away.gens.minion.owned = new Decimal(500);
    await writeSave(serialize(away, 0));

    const { result } = await ready();

    expect(result.current.state.earnedAchievements.length).toBeGreaterThan(0);
  });

  it('unlocks a tier the player can nearly afford, and keeps it unlocked', async () => {
    const { result } = await ready();

    act(() => void result.current.dispatch({ kind: 'smite' }));

    expect(result.current.state.unlocked.minion).toBe(true);
  });

  it('forgets everything on abdication', async () => {
    await writeSave(serialize(createState(CURRENT), 0));
    const { result } = await ready();

    await act(async () => result.current.abdicate());

    expect(result.current.state.stats.playTimeMs).toBe(0);
  });
});
