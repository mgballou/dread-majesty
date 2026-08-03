import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setReducedMotion } from '../../test/setup.ts';
import { useReducedMotion } from './useReducedMotion.ts';

describe('useReducedMotion', () => {
  it('reports false when the preference is unset', () => {
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it('reports true when the preference asks for reduced motion', () => {
    setReducedMotion(true);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });
});
