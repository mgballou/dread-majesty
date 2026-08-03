import { useEffect, useRef, useState } from 'react';
import type { Content } from '@dm/content';
import { BASE_DT_MS, createState, step } from '@dm/engine';
import type { GameState } from '@dm/engine';

/**
 * Drives the engine from real time.
 *
 * Time enters here and nowhere else — the engine never reads a clock. Elapsed
 * milliseconds are banked and spent in whole `BASE_DT_MS` slices, so cycle
 * completion stays exact no matter how the browser schedules frames. The
 * leftover carries to the next frame.
 *
 * A tab that is backgrounded or throttled simply banks more time and catches up,
 * which is the same path `catchUp` takes for a real absence.
 */
export function useGameLoop(content: Content): { state: GameState; version: number } {
  const stateRef = useRef<GameState | null>(null);
  stateRef.current ??= createState(content);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let banked = 0;

    const tick = (now: number): void => {
      banked += now - last;
      last = now;

      const slices = Math.floor(banked / BASE_DT_MS);
      if (slices > 0) {
        banked -= slices * BASE_DT_MS;
        const state = stateRef.current;
        if (state) {
          for (let i = 0; i < slices; i += 1) step(state, content, BASE_DT_MS);
          setVersion((previous) => previous + 1);
        }
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [content]);

  return { state: stateRef.current, version };
}
