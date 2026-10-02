import { CURRENT } from '@dm/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchChain, isNewerVersion } from './chain.ts';

const url = 'https://chain.test/current.json';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchChain', () => {
  it('keeps the bundled chain when the server answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('gone', { status: 404 }))),
    );

    expect(await fetchChain({ url, bundled: CURRENT })).toBe(CURRENT);
  });

  it('keeps the bundled chain when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('<html>'))),
    );

    expect(await fetchChain({ url, bundled: CURRENT })).toBe(CURRENT);
  });

  it('keeps the bundled chain when a newer one fails validation', async () => {
    const broken = { ...CURRENT, version: '2', tiers: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json(broken))),
    );

    expect(await fetchChain({ url, bundled: CURRENT })).toBe(CURRENT);
  });

  it('keeps the bundled chain when the fetched one is the same version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ ...CURRENT }))),
    );

    expect(await fetchChain({ url, bundled: CURRENT })).toBe(CURRENT);
  });

  it('gives up on a server that never answers', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('', 'AbortError')),
            );
          }),
      ),
    );

    const pending = fetchChain({ url, bundled: CURRENT, timeoutMs: 3000 });
    await vi.advanceTimersByTimeAsync(3000);

    expect(await pending).toBe(CURRENT);
  });
});

describe('isNewerVersion', () => {
  it.each([
    ['2', '1', true],
    ['1.10', '1.9', true],
    ['v1.0.1', '1', true],
    ['1.0', '1', false],
    ['1', '2', false],
    ['next', '1', false],
  ])('reads %s against %s as %s', (candidate, current, newer) => {
    expect(isNewerVersion(candidate, current)).toBe(newer);
  });
});
