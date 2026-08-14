import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion.ts';
import './Spotlight.css';

/** How far the ring stands off the region it frames. */
const HALO_PX = 8;

interface SpotlightProps {
  /**
   * Selector for the control this beat names.
   *
   * Absent for a narrative beat, which points at nothing and dims the whole screen
   * at the lighter `--scrim-soft`. A selector that matches nothing, or matches
   * something with no size, falls back to the whole screen at the full `--scrim`
   * rather than cutting a zero-sized hole, which would read as a rendering fault —
   * the same fallback the deleted first-run tour used.
   */
  target?: string;
}

interface Frame {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Dims the screen and cuts a click-through hole around one live control.
 *
 * Presentational only: it is handed a selector or nothing and draws the dim. It does
 * not decide which control a beat names — the caller does that — and it never blocks
 * a click. `pointer-events: none` runs through the whole tree, so the control the
 * ring surrounds, and everything else under the dim, stays genuinely operable. That
 * is the property the modal tour this replaces could not offer: it could take the
 * screen, but not let the player act inside it.
 *
 * Four plain rectangles around the hole rather than a mask or a spread shadow — the
 * geometry the deleted `Tour.tsx` used — because they need no compositing and cost
 * nothing to move on a phone.
 */
export function Spotlight({ target }: SpotlightProps): ReactNode {
  const [frame, setFrame] = useState<Frame | null>(null);
  const reducedMotion = useReducedMotion();

  const measure = useCallback((): void => {
    const element = target === undefined ? null : document.querySelector(target);
    const rect = element?.getBoundingClientRect();

    if (rect === undefined || rect.width <= 0 || rect.height <= 0) {
      setFrame(null);
      return;
    }

    setFrame({
      top: rect.top - HALO_PX,
      left: rect.left - HALO_PX,
      width: rect.width + HALO_PX * 2,
      height: rect.height + HALO_PX * 2,
    });
  }, [target]);

  useLayoutEffect(() => {
    if (target !== undefined) {
      const element = document.querySelector(target);
      // jsdom implements no scrolling, so the call is optional rather than guarded by
      // a capability check — the real branch then runs everywhere the real method
      // exists.
      element?.scrollIntoView?.({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }
    measure();
  }, [measure, reducedMotion, target]);

  useEffect(() => {
    // `scroll` is captured rather than bubbled: the stage scrolls inside its own
    // track, and that scroll never reaches the window.
    addEventListener('resize', measure);
    addEventListener('scroll', measure, true);
    return () => {
      removeEventListener('resize', measure);
      removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  const mode = target === undefined ? 'soft' : frame === null ? 'whole' : 'cutout';

  return (
    <div
      className={`spotlight spotlight--${mode}`}
      data-testid="spotlight"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      {mode === 'cutout' && frame !== null ? (
        <>
          <div
            className="spotlight__band"
            style={{ top: 0, left: 0, right: 0, height: frame.top }}
          />
          <div
            className="spotlight__band"
            style={{ top: frame.top + frame.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="spotlight__band"
            style={{ top: frame.top, left: 0, width: frame.left, height: frame.height }}
          />
          <div
            className="spotlight__band"
            style={{
              top: frame.top,
              left: frame.left + frame.width,
              right: 0,
              height: frame.height,
            }}
          />
          <div
            className="spotlight__ring"
            style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
          />
        </>
      ) : (
        <div className="spotlight__band" style={{ top: 0, left: 0, right: 0, bottom: 0 }} />
      )}
    </div>
  );
}
