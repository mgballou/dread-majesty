import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TOUR_STEP_IDS, type TourCopy, type TourStepId } from '@dm/content';
import { useReducedMotion } from './useReducedMotion.ts';
import './Tour.css';

/** How far the cutout stands off the region it frames. */
const HALO_PX = 8;

interface TourProps {
  copy: TourCopy;
  /**
   * Which region of the screen each step points at, as a selector for that region's
   * root.
   *
   * Selectors rather than refs because the crown, the stage and the deck are all grid
   * items or direct children of a laid-out frame: wrapping any of them in a element to
   * hold a ref would change what the layout is arranging. A selector reaches the
   * elements that already exist and moves nothing.
   *
   * The cost is a class rename silently losing a highlight, which `Tour.anchors.test`
   * exists to catch — it renders the real app and asserts every selector here resolves.
   *
   * Partial on purpose: a step with no anchor dims the whole screen and centres its
   * card, which is what the opening card wants. A selector that matches nothing is
   * treated the same way, so a step can never point at nothing and leave the player
   * staring at a hole.
   */
  anchors: Partial<Record<TourStepId, string>>;
  /** Called once, whether the player walked it or left early. */
  onFinish: () => void;
}

interface Frame {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The first run, explained once.
 *
 * The platform's `<dialog>`, opened modally, for the reasons in `Sheet`: focus lands
 * inside it, Escape leaves, and the game behind goes inert. Its backdrop is
 * transparent, because the dimming here is not one sheet over everything — it is four
 * bands drawn around the region being talked about, leaving that region lit through the
 * hole they surround.
 *
 * Four bands rather than a mask or a spread shadow: they are four plain rectangles,
 * they need no compositing, and on a phone they cost nothing to move. The geometry is
 * inline because it is measured at run time and changes with every step — the colours
 * and the ring live in the stylesheet, where the tokens are.
 *
 * **The card never sits over the thing it points at.** It takes the half of the screen
 * the anchor is not in, which needs no measurement of the card and so cannot overlap
 * however long the copy runs or however small the phone.
 */
export function Tour({ copy, anchors, onFinish }: TourProps): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [frame, setFrame] = useState<Frame | null>(null);
  const reducedMotion = useReducedMotion();

  const stepId = TOUR_STEP_IDS[index] ?? TOUR_STEP_IDS[0];
  const step = copy.steps[stepId];
  const last = index === TOUR_STEP_IDS.length - 1;
  const selector = anchors[stepId];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    card.current?.focus?.();
  }, []);

  // Escape and the buttons leave by the same door, so the parent's state cannot drift
  // from what is on screen. See Sheet.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return undefined;

    element.addEventListener('close', onFinish);
    return () => element.removeEventListener('close', onFinish);
  }, [onFinish]);

  const measure = useCallback((): void => {
    const anchor = selector === undefined ? null : document.querySelector(selector);
    const rect = anchor?.getBoundingClientRect();

    // jsdom measures everything as zero, and a real region can be scrolled fully out of
    // view. Either way there is nothing to frame, and a zero-sized hole in the middle of
    // the scrim reads as a rendering fault. Fall back to the undimmed whole screen.
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      setFrame(null);
      return;
    }

    setFrame({
      top: rect.top - HALO_PX,
      left: rect.left - HALO_PX,
      width: rect.width + HALO_PX * 2,
      height: rect.height + HALO_PX * 2,
    });
  }, [selector]);

  useLayoutEffect(() => {
    if (selector !== undefined) {
      const anchor = document.querySelector(selector);
      // jsdom implements no scrolling, so the call is optional rather than guarded by a
      // capability check — the real branch then runs everywhere the real method exists.
      anchor?.scrollIntoView?.({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
      });
    }
    measure();
  }, [measure, reducedMotion, selector]);

  useEffect(() => {
    // `scroll` is captured rather than bubbled: the stage scrolls inside its own track
    // and that scroll never reaches the window.
    addEventListener('resize', measure);
    addEventListener('scroll', measure, true);
    return () => {
      removeEventListener('resize', measure);
      removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  const leave = (): void => dialog.current?.close();

  // Where the card sits: centred when nothing is framed, otherwise whichever side of
  // the frame has more room. Comparing free space rather than which half the anchor's
  // middle falls in, because the deck is nearly the height of the viewport — against a
  // frame that tall the halves are a coin toss, and the free-space reading still puts
  // the card over the emptiest part of it. An anchor taller than the viewport leaves
  // nowhere clear at all; the card overlaps then, and the ring is what carries the
  // pointing.
  const half =
    frame === null
      ? 'center'
      : frame.top > innerHeight - (frame.top + frame.height)
        ? 'top'
        : 'bottom';

  return (
    <dialog className="tour" ref={dialog} aria-label={copy.label}>
      {frame === null ? (
        <div className="tour__scrim tour__scrim--whole" />
      ) : (
        <>
          <div className="tour__scrim" style={{ top: 0, left: 0, right: 0, height: frame.top }} />
          <div
            className="tour__scrim"
            style={{ top: frame.top + frame.height, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className="tour__scrim"
            style={{ top: frame.top, left: 0, width: frame.left, height: frame.height }}
          />
          <div
            className="tour__scrim"
            style={{
              top: frame.top,
              left: frame.left + frame.width,
              right: 0,
              height: frame.height,
            }}
          />
          <div
            className="tour__ring"
            style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height }}
          />
        </>
      )}

      {/* Focus lands on the card, not on the first control in it. `showModal` would
          otherwise put it on Skip, which draws the accent focus ring around leaving —
          the one thing on the card that is not the action being offered. */}
      <div className={`tour__card tour__card--${half}`} ref={card} tabIndex={-1}>
        {/* The step's text is swapped in place rather than remounted, so a screen
            reader hears the change without the dialog being announced again. */}
        <div aria-live="polite">
          <p className="tour__count">
            {copy.progress({ step: String(index + 1), of: String(TOUR_STEP_IDS.length) })}
          </p>
          <h2 className="tour__title">{step.title}</h2>
          <p className="tour__body">{step.body}</p>
        </div>

        <div className="tour__controls">
          <button type="button" className="button button--quiet" onClick={leave}>
            {copy.skip}
          </button>

          <div className="tour__walk">
            {index > 0 && (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setIndex(index - 1)}
              >
                {copy.back}
              </button>
            )}
            {/* The tour's one accent, and the only one on screen while it is up:
                everything behind it is inert and cannot offer an action. */}
            <button
              type="button"
              className="button button--primary"
              onClick={() => (last ? leave() : setIndex(index + 1))}
            >
              {last ? copy.done : copy.next}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Where each step points.
 *
 * Here rather than in `App` because it is the other half of the contract the anchors
 * test checks, and the two belong beside each other. `premise` names nothing: the
 * opening card introduces the game rather than a region of it.
 */
export const TOUR_ANCHORS: Partial<Record<TourStepId, string>> = {
  evil: '.crown',
  // The track rather than the whole stage. Both of these cards talk about the rungs,
  // and the stage's own box runs up against the crown — framing it puts the cutout's
  // edge through the middle of the crown's line of text, which reads as a seam.
  rouse: '.stage__track',
  chain: '.stage__track',
  cascade: '.deck',
};
