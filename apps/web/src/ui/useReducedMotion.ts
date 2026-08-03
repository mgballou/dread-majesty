import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * The one place the motion preference is read.
 *
 * Every animated primitive calls this, so no caller has to remember (ui-sensibility
 * §8). Reduced motion drops movement, never content: rings jump instead of
 * sweeping, motes fade in place instead of travelling, numbers still roll. Nothing
 * visible under normal motion may go missing.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => matchMedia(QUERY).matches);

  useEffect(() => {
    const query = matchMedia(QUERY);
    const onChange = (): void => setReduced(query.matches);

    setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
