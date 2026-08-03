/**
 * Every sound the game makes, described rather than recorded.
 *
 * Synthesised at play time from these numbers, so the repository carries no audio
 * files, the build fetches nothing, and a cue is retuned by editing a line. The
 * palette is deliberately narrow: low sine tones with a fast decay, which read as
 * struck stone rather than as a user-interface bleep.
 */
export interface Cue {
  /** Starting pitch in hertz. */
  readonly from: number;
  /** Pitch at the end of the sweep. Equal to `from` for a flat tone. */
  readonly to: number;
  readonly durationMs: number;
  /** Peak gain, well under 1 so stacked cues cannot clip. */
  readonly gain: number;
  readonly wave: OscillatorType;
}

export const CUES = {
  /** The tap verb. Blunt and low, with a downward sweep like something dropped. */
  smite: { from: 220, to: 70, durationMs: 180, gain: 0.18, wave: 'sine' },
  /** A purchase lands. Short, dry, slightly up — an assent. */
  purchase: { from: 320, to: 380, durationMs: 90, gain: 0.12, wave: 'triangle' },
  /** A milestone doubles a tier. Rarer, so it may ring longer. */
  milestone: { from: 440, to: 660, durationMs: 320, gain: 0.14, wave: 'sine' },
  /** A tier becomes visible for the first time. */
  unlock: { from: 180, to: 540, durationMs: 420, gain: 0.14, wave: 'sine' },
  /**
   * A manual tier is set turning. The quietest thing in the game on purpose — it
   * fires every four seconds through the opening, and a cue that carries at that
   * rate is a cue the player mutes the game to escape.
   */
  rouse: { from: 150, to: 130, durationMs: 60, gain: 0.07, wave: 'triangle' },
  /** The reset. The lowest and longest thing in the game. */
  prestige: { from: 110, to: 55, durationMs: 900, gain: 0.2, wave: 'sine' },
} as const satisfies Record<string, Cue>;

export type CueId = keyof typeof CUES;
