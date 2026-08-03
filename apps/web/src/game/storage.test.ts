import 'fake-indexeddb/auto';
import Decimal from 'break_eternity.js';
import { CURRENT } from '@dm/content';
import { createState, deserialize, serialize } from '@dm/engine';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave, readSave, writeSave } from './storage.ts';

beforeEach(async () => {
  await clearSave();
});

describe('the save store', () => {
  it('reports nothing when no save has been written', async () => {
    expect(await readSave()).toBeNull();
  });

  it('round-trips a save through the browser and back into state', async () => {
    const state = createState(CURRENT);
    state.gens.minion.owned = new Decimal('1e80');
    state.souls = new Decimal(13);

    await writeSave(serialize(state, 1000));
    const blob = await readSave();

    expect(deserialize(blob!).gens.minion.owned.toString()).toBe('1e80');
  });

  it('keeps the time the save was written', async () => {
    await writeSave(serialize(createState(CURRENT), 987_654));

    expect((await readSave())?.savedAtMs).toBe(987_654);
  });

  it('forgets a save once cleared', async () => {
    await writeSave(serialize(createState(CURRENT), 1000));
    await clearSave();

    expect(await readSave()).toBeNull();
  });

  it('treats storage being denied as an absence rather than a failure', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(await readSave()).toBeNull();
    expect(await writeSave(serialize(createState(CURRENT), 1000))).toBe(false);

    vi.restoreAllMocks();
  });
});
