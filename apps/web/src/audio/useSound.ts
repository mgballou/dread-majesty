import { useCallback, useEffect, useRef, useState } from 'react';
import { CUES, type CueId } from './cues.ts';

const STORAGE_KEY = 'dread-majesty:sound';

export interface Sound {
  enabled: boolean;
  toggle: () => void;
  play: (cue: CueId) => void;
}

/**
 * Sound, off until asked for.
 *
 * Muted by default and remembered, because a game that makes noise the moment it
 * loads is a game people close. No `AudioContext` is constructed until the player
 * turns sound on — browsers refuse to start one before a gesture anyway, and not
 * constructing it means a browser with no Web Audio at all simply has a toggle that
 * does nothing rather than a crash.
 */
export function useSound(): Sound {
  const [enabled, setEnabled] = useState(readPreference);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!enabled) {
      contextRef.current?.close();
      contextRef.current = null;
    }
    writePreference(enabled);
  }, [enabled]);

  useEffect(() => () => void contextRef.current?.close(), []);

  const play = useCallback(
    (id: CueId): void => {
      if (!enabled) return;

      const context = (contextRef.current ??= createContext());
      if (!context) return;

      const cue = CUES[id];
      const seconds = cue.durationMs / 1000;
      const now = context.currentTime;

      const oscillator = context.createOscillator();
      oscillator.type = cue.wave;
      oscillator.frequency.setValueAtTime(cue.from, now);
      oscillator.frequency.exponentialRampToValueAtTime(cue.to, now + seconds);

      // Ramping to an audible floor and stopping there, rather than to zero: an
      // exponential ramp cannot reach zero, and a linear one clicks.
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(cue.gain, now);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + seconds);
    },
    [enabled],
  );

  const toggle = useCallback((): void => setEnabled((previous) => !previous), []);

  return { enabled, toggle, play };
}

function createContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  return new AudioContext();
}

function readPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writePreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // A browser refusing storage is not a reason to refuse sound.
  }
}
