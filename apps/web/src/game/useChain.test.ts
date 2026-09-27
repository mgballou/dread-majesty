import { CURRENT } from '@dm/content';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChain } from './useChain.ts';

const url = 'https://chain.test/current.json';

function serve(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json(body))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useChain', () => {
  it('runs on the bundled chain without asking anyone when no URL is set', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const { result } = renderHook(() => useChain(null));

    expect(result.current).toEqual({ content: CURRENT, settled: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('holds the session until the fetch answers', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );

    const { result } = renderHook(() => useChain(url));

    expect(result.current.settled).toBe(false);
  });

  it('uses a valid newer chain', async () => {
    const newer = { ...CURRENT, version: '2' };
    serve(newer);

    const { result } = renderHook(() => useChain(url));

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.content).toEqual(newer);
  });

  it('falls back to the bundled chain when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    const { result } = renderHook(() => useChain(url));

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.content).toBe(CURRENT);
  });

  it('falls back to the bundled chain when the fetched one is older', async () => {
    serve({ ...CURRENT, version: '0.9' });

    const { result } = renderHook(() => useChain(url));

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.content).toBe(CURRENT);
  });
});
