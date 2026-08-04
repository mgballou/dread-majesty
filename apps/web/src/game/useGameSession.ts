import { useCallback, useEffect, useRef, useState } from 'react';
import type { AchievementId, Content } from '@dm/content';
import {
  BASE_DT_MS,
  ObsoleteSave,
  apply,
  catchUp,
  createState,
  deserialize,
  exportSave,
  importSave,
  newlyEarnedAchievements,
  serialize,
  step,
} from '@dm/engine';
import type { GameState, Intent, IntentResult, OfflineReport } from '@dm/engine';
import { clearSave, readSave, writeSave } from './storage.ts';

/** How often the game writes itself down while it is being played. */
const AUTOSAVE_MS = 10_000;

/**
 * How often achievement conditions and unlock thresholds are checked.
 *
 * Never inside `step` — that runs 36,000 times to catch up an hour and must not scan
 * the content list each time. A second's delay on a trophy is invisible; a scan per
 * slice is not.
 */
const RECONCILE_MS = 1000;

/**
 * How long an absence has to be before the return summary interrupts.
 *
 * Two minutes. `catchUp` runs whatever the gap, so nothing is ever lost — this is
 * only about whether a modal takes the screen. Below this the sheet is noise: an
 * alt-tab to answer a message came back to a full-page interruption reporting nine
 * seconds of work, which is worse than showing nothing.
 *
 * There is no research to point at. The floor was picked as the shortest gap that
 * plausibly means the player left, and it is one constant to move when real players
 * say otherwise.
 */
const RETURN_SUMMARY_FLOOR_MS = 2 * 60 * 1000;

export interface Session {
  state: GameState;
  /** Bumps whenever the state moved. Components read state; this is what re-renders them. */
  version: number;
  /** The boot screen holds until the save has actually been read. */
  ready: boolean;
  /** What happened while the player was away. Null once dismissed. */
  offline: OfflineReport | null;
  dismissOffline: () => void;
  /** Achievements earned since the last render. Empty most frames. */
  justEarned: readonly AchievementId[];
  /** True when the save on disk was refused for being too old. Cleared on dismissal. */
  saveRefused: boolean;
  dismissRefusal: () => void;
  dispatch: (intent: Intent) => IntentResult;
  exportBlob: () => string;
  importBlob: (encoded: string) => boolean;
  abdicate: () => void;
  /**
   * Swaps a whole state in, over the same boundary an imported save crosses.
   *
   * Only the dev workbench calls these two. They live on the session rather than in
   * `dev/` because the state reference and the return summary belong to this hook
   * and nothing outside it may reach in and move them.
   */
  replaceState: (next: GameState) => void;
  /** Runs `catchUp` for an absence that did not happen, and raises the summary. */
  simulateOffline: (elapsedMs: number) => void;
}

/**
 * The whole game, driven from real time.
 *
 * Time and storage enter here and nowhere else — the engine reads no clock and
 * performs no I/O, which is what keeps every engine test a plain assertion. This
 * hook is the boundary those two facts meet at.
 *
 * Elapsed milliseconds are banked and spent in whole `BASE_DT_MS` slices, so cycle
 * completion stays exact however the browser schedules frames, and the leftover
 * carries. A backgrounded tab simply banks more time and catches up down the same
 * path `catchUp` takes for a real absence.
 */
export function useGameSession(content: Content): Session {
  const stateRef = useRef<GameState | null>(null);
  stateRef.current ??= createState(content);

  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState<OfflineReport | null>(null);
  const [justEarned, setJustEarned] = useState<readonly AchievementId[]>([]);
  const [saveRefused, setSaveRefused] = useState(false);
  const loaded = useRef(false);

  /**
   * Checks what the player has become entitled to and records it.
   *
   * The earned list is read before the intent runs, because the intent is what
   * clears it — the caller wants to know what was won, and after recording there is
   * nothing left to see.
   */
  const reconcile = useCallback((): void => {
    const state = stateRef.current;
    if (!state) return;

    const earned = newlyEarnedAchievements(state, content);
    apply(state, content, { kind: 'record-achievements' });
    apply(state, content, { kind: 'record-unlocks' });

    if (earned.length > 0) {
      setJustEarned(earned);
      setVersion((previous) => previous + 1);
    }
  }, [content]);

  /**
   * Load once, per mount of the app, and never cancel.
   *
   * Deliberately no cleanup flag. StrictMode mounts an effect, tears it down and
   * mounts it again; a `cancelled` flag set by that teardown would abandon the only
   * read the `loaded` guard permits, and the game would sit on its boot screen for
   * ever. The single guard is the whole of the concurrency control, and the two
   * setters it reaches are safe after unmount.
   */
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    void readSave().then((blob) => {
      if (blob) {
        try {
          const restored = deserialize(blob);
          stateRef.current = restored;

          const report = catchUp(restored, content, Date.now() - blob.savedAtMs);
          if (report.elapsedMs >= RETURN_SUMMARY_FLOOR_MS) setOffline(report);
        } catch (error) {
          // A refused save is the one failure worth telling the player about: it is
          // ours, it is permanent, and starting fresh in silence looks like data loss.
          // Anything else is unreadable data nobody can be helped with here, and the
          // old blob stays on disk until the first autosave overwrites it.
          if (error instanceof ObsoleteSave) setSaveRefused(true);
        }
      }

      reconcile();
      setReady(true);
      setVersion((previous) => previous + 1);
    });
  }, [content, reconcile]);

  useEffect(() => {
    if (!ready) return undefined;

    const timer = setInterval(reconcile, RECONCILE_MS);
    return () => clearInterval(timer);
  }, [ready, reconcile]);

  useEffect(() => {
    if (!ready) return undefined;

    let frame = 0;
    let last = performance.now();
    let banked = 0;

    const tick = (now: number): void => {
      banked += now - last;
      last = now;

      const slices = Math.floor(banked / BASE_DT_MS);
      const state = stateRef.current;

      if (slices > 0 && state) {
        banked -= slices * BASE_DT_MS;
        for (let i = 0; i < slices; i += 1) step(state, content, BASE_DT_MS);
        state.stats.playTimeMs += slices * BASE_DT_MS;
        state.stats.runMs += slices * BASE_DT_MS;
        setVersion((previous) => previous + 1);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [content, ready]);

  const save = useCallback((): void => {
    const state = stateRef.current;
    if (!state || !ready) return;
    void writeSave(serialize(state, Date.now()));
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;

    const timer = setInterval(save, AUTOSAVE_MS);

    // `pagehide` fires where `beforeunload` does not — a phone discarding the tab,
    // a back-forward cache entry. `visibilitychange` catches the app switch that
    // never becomes an unload at all.
    const onLeave = (): void => save();
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') save();
    };

    addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      clearInterval(timer);
      removeEventListener('pagehide', onLeave);
      document.removeEventListener('visibilitychange', onHide);
      save();
    };
  }, [ready, save]);

  const dispatch = useCallback(
    (intent: Intent): IntentResult => {
      const state = stateRef.current;
      if (!state) return { ok: false, intent, reason: 'nothing-affordable' };

      const result = apply(state, content, intent);
      // A purchase can cross a threshold and reveal the next tier. Waiting up to a
      // second to notice would make the player's own action look unrelated.
      reconcile();
      setVersion((previous) => previous + 1);
      return result;
    },
    [content, reconcile],
  );

  const exportBlob = useCallback((): string => {
    const state = stateRef.current;
    return state ? exportSave(state, Date.now()) : '';
  }, []);

  const importBlob = useCallback((encoded: string): boolean => {
    try {
      stateRef.current = importSave(encoded);
      setVersion((previous) => previous + 1);
      return true;
    } catch {
      return false;
    }
  }, []);

  const abdicate = useCallback((): void => {
    stateRef.current = createState(content);
    setOffline(null);
    setJustEarned([]);
    setVersion((previous) => previous + 1);
    void clearSave();
  }, [content]);

  const replaceState = useCallback(
    (next: GameState): void => {
      stateRef.current = next;
      reconcile();
      setOffline(null);
      setJustEarned([]);
      setVersion((previous) => previous + 1);
    },
    [reconcile],
  );

  const simulateOffline = useCallback(
    (elapsedMs: number): void => {
      const state = stateRef.current;
      if (!state) return;

      setOffline(catchUp(state, content, elapsedMs));
      setVersion((previous) => previous + 1);
    },
    [content],
  );

  const dismissOffline = useCallback((): void => setOffline(null), []);
  const dismissRefusal = useCallback((): void => setSaveRefused(false), []);

  return {
    state: stateRef.current,
    version,
    ready,
    offline,
    dismissOffline,
    justEarned,
    saveRefused,
    dismissRefusal,
    dispatch,
    exportBlob,
    importBlob,
    abdicate,
    replaceState,
    simulateOffline,
  };
}
