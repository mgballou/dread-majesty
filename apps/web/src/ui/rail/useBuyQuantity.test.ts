import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuyQuantity } from './useBuyQuantity.ts';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBuyQuantity', () => {
  it('starts at one', () => {
    const { result } = renderHook(() => useBuyQuantity());

    expect(result.current.quantity).toBe(1);
  });

  it('reads a stored quantity back as a number', () => {
    localStorage.setItem('dm.buy-quantity', '100');

    const { result } = renderHook(() => useBuyQuantity());

    expect(result.current.quantity).toBe(100);
  });

  it('reads a stored max back as max', () => {
    localStorage.setItem('dm.buy-quantity', 'max');

    const { result } = renderHook(() => useBuyQuantity());

    expect(result.current.quantity).toBe('max');
  });

  it('ignores a stored value that is not a quantity', () => {
    localStorage.setItem('dm.buy-quantity', '7');

    const { result } = renderHook(() => useBuyQuantity());

    expect(result.current.quantity).toBe(1);
  });

  it('writes the chosen quantity down', () => {
    const { result } = renderHook(() => useBuyQuantity());

    act(() => result.current.setQuantity('max'));

    expect(localStorage.getItem('dm.buy-quantity')).toBe('max');
  });

  it('keeps working when the browser refuses to read storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });

    const { result } = renderHook(() => useBuyQuantity());

    expect(result.current.quantity).toBe(1);
  });

  it('keeps working when the browser refuses to write storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    const { result } = renderHook(() => useBuyQuantity());

    act(() => result.current.setQuantity(10));

    expect(result.current.quantity).toBe(10);
  });
});
