import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSound } from './useSound.ts';

const constructed = vi.fn();

class StubAudioContext {
  currentTime = 0;
  destination = {};

  constructor() {
    constructed();
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: () => ({ connect: vi.fn() }),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
  }

  close = vi.fn();
}

vi.stubGlobal('AudioContext', StubAudioContext);

afterEach(() => {
  constructed.mockClear();
  localStorage.clear();
});

describe('useSound', () => {
  it('starts muted', () => {
    const { result } = renderHook(() => useSound());

    expect(result.current.enabled).toBe(false);
  });

  it('constructs no audio context while muted', () => {
    const { result } = renderHook(() => useSound());

    act(() => result.current.play('smite'));

    expect(constructed).not.toHaveBeenCalled();
  });

  it('constructs the context only once sound is turned on', () => {
    const { result } = renderHook(() => useSound());

    act(() => result.current.toggle());
    act(() => result.current.play('smite'));

    expect(constructed).toHaveBeenCalledTimes(1);
  });

  it('remembers the preference', () => {
    const first = renderHook(() => useSound());
    act(() => first.result.current.toggle());
    first.unmount();

    const second = renderHook(() => useSound());

    expect(second.result.current.enabled).toBe(true);
  });
});
