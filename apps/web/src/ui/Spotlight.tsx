import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
    measure();
  }, [measure]);

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

  /**
   * Measures again when the target's own box changes, which is what the window's
   * events cannot see.
   *
   * A beat that names a control inside a shut deck panel arrives one render before the
   * deck opens that panel. The layout effect above therefore measures an element that
   * is mounted but hidden, reads zero, and falls back to dimming everything — and
   * opening a tab fires neither a resize nor a scroll, so nothing ever asks again. The
   * `appoint` beat points into the miscreants, which is never the tab in front, so
   * without this it dims the whole screen for the rest of the beat.
   *
   * A `ResizeObserver` rather than a poll or a frame loop: hidden to sized is exactly a
   * box going from zero to a size, which is the one thing it reports, and it costs
   * nothing while nothing moves. It is deliberately the element's box only — a target
   * that merely *moves*, with no size change, is still the resize and scroll listeners'
   * business.
   */
  useEffect(() => {
    if (target === undefined) return undefined;

    const element = document.querySelector(target);
    if (element === null) return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, target]);

  /**
   * Brings the target into view, once, as soon as it has a box to bring.
   *
   * Keyed on the measurement rather than on the selector, because a target inside a shut
   * deck panel is `display: none` at the moment the selector changes — scrolling to it
   * then is a no-op, and the hole would be cut wherever the player happened to be
   * standing. A hole below the fold is invisible, which is the same fault as a prompt
   * below the fold.
   *
   * **Once per target, not once per measurement.** The observer above and the scroll
   * listener both fire repeatedly; scrolling on each would yank the page out from under
   * somebody reading, and would drag back anybody who scrolled away on purpose. The ref
   * holds the target last scrolled to, so this fires on the way into a measured frame and
   * then leaves the player alone until a different control is named.
   *
   * **A layout effect, so the scroll resolves before anything paints. Do not make it a
   * passive one.** Under reduced motion the scroll is instant, and a passive effect runs
   * after the browser's first paint — so the ring would show for a frame at its
   * pre-scroll position and then snap. Full motion hides this, because a sweep starting a
   * tick later looks the same; reduced motion is the case that must not flash.
   */
  const scrolledTo = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (target === undefined || frame === null || scrolledTo.current === target) return;
    scrolledTo.current = target;

    // jsdom implements no scrolling, so the call is optional rather than guarded by a
    // capability check — the real branch then runs everywhere the real method exists.
    document.querySelector(target)?.scrollIntoView?.({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    });
  }, [frame, reducedMotion, target]);

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
