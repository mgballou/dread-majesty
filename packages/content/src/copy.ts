import type { AchievementId, DominionBeatId, OverseerId, SmiteUpgradeId, TierId } from './ids.ts';

/**
 * Every player-facing string that is not a tier name.
 *
 * Deliberately **not** part of `Content`. The engine takes `Content` as an argument
 * and must never care about a string; folding copy in would force every engine
 * fixture to carry forty lines of prose it will never read. The web app imports
 * `CURRENT_COPY` beside `CURRENT` instead.
 *
 * Keyed rather than free — `Record<AchievementId, …>` and `Record<TierId, …>` mean a
 * new achievement or tier without copy fails typecheck rather than shipping blank.
 * A tone pass is then one file, and a translation is a second file next to it.
 *
 * Where a number belongs inside a sentence the entry is a function taking the
 * already-formatted string, never a template with a token for someone to replace.
 * Formatting is the web app's one shared formatter; wording is here.
 */

/** One line saying what a rung of the chain is. */
export interface TierCopy {
  readonly flavour: string;
}

export interface ResourceCopy {
  readonly name: string;
  readonly flavour: string;
}

export interface AchievementCopy {
  /** Four words or fewer. */
  readonly name: string;
  /** What the player did, then one dry fact about it. */
  readonly description: string;
}

export interface SmiteCopy {
  readonly action: string;
  readonly hint: string;
  /**
   * Spoken name of the control, which is the Evil total itself.
   *
   * The total is the tap target, so its accessible name has to carry the verb, the
   * figure, and how tired the realm is. `band` is one of `SmiteCopy.bands`. The Apathy
   * gauge is drawn inside this control, and a label inside a button that carries an
   * `aria-label` is never announced — so this is the only place the band reaches
   * anyone reading by ear. Both parts arrive formatted.
   */
  readonly spoken: (amount: string, band: string) => string;
  /**
   * What the control says while the blow is spent.
   *
   * **Five characters, like every other face of this control.** A button whose label
   * changes length moves everything beside it, and this one changes three times a
   * minute. `action` is the third face; the second is not a word at all but the live
   * multiplier, which the web prints as `×0.00` — also five.
   *
   * There is no word for the running state any more. It used to say "Surge", which
   * named the state without saying what it was worth; the number does both.
   */
  readonly cooling: string;
  /** Said on the status line while a blow is ready. */
  readonly ready: string;
  /** Said on the status line while one is running. Not a countdown — the chain is that. */
  readonly reigning: string;
  /** Said on the status line while one is not. `seconds` arrives formatted. */
  readonly until: (seconds: string) => string;
  /** One line saying what a blow is worth, for the hint. `multiplier` arrives formatted. */
  readonly worth: (args: { readonly multiplier: string; readonly seconds: string }) => string;
  /** Shown one at a time after a smite. Never empty. */
  readonly results: readonly string[];
  /**
   * Where the realm stands, in thirds of the Apathy cap. Empty, middling, full.
   *
   * **Apathy**, and the word is the joke played straight: the realm does not fear you
   * less, it simply cannot be bothered any more. The Dark Lord's real enemy turns out
   * to be being ignored.
   *
   * Three, and the length is pinned by the type, so a fourth band cannot be added
   * without the code that picks one being made to say what it means. These are the
   * whole of what the gauge says: the arc around the medallion shows how far along the
   * realm is and these say what that means, so nothing has to print a number the
   * player would have to reason about. The arc itself is hidden from assistive tech,
   * so one of these rides on the control's own name instead — see `spoken`.
   */
  readonly bands: readonly [string, string, string];
}

/**
 * The shop. Four ladders, climbed with Evil and locked with souls.
 *
 * `names` and `notes` are keyed by id, so a ladder without copy fails typecheck rather
 * than shipping blank. Numbers arrive formatted — the web owns `formatNumber` and this
 * file owns the words around it.
 */
export interface MaliceCopy {
  readonly title: string;
  readonly names: Readonly<Record<SmiteUpgradeId, string>>;
  /** One line saying what the ladder does, in voice. */
  readonly notes: Readonly<Record<SmiteUpgradeId, string>>;
  /** "Rung 2 of 4". Both arrive formatted. */
  readonly rung: (args: { readonly at: string; readonly of: string }) => string;
  /** What the ladder reads now and what the next rung would read. Both formatted. */
  readonly step: (args: { readonly now: string; readonly next: string }) => string;
  /** The Evil action. */
  readonly climb: string;
  readonly climbCost: (cost: string) => string;
  /** The souls action, beside it at secondary weight. */
  readonly keep: string;
  readonly keepCost: (cost: string) => string;
  /** Standing for a ladder at the top of itself. */
  readonly maxed: string;
  /** Standing for a ladder whose rung is already permanent. */
  readonly held: string;
  /** Said, never shown, on the row the panel lifted. */
  readonly lifted: string;
}

export interface MilestoneCopy {
  readonly name: string;
  readonly what: string;
  /**
   * Names the milestone bar, and carries the figures the printed line used to.
   *
   * Every part arrives formatted, e.g. "×2" and "25", so no balance number lives here.
   * The bar replaced a line of text, so this string is the only place those numbers
   * still live — it is read by pointer through `title` and by ear through `aria-label`.
   */
  readonly bar: (args: {
    readonly remaining: string;
    readonly plural: string;
    readonly multiplier: string;
    readonly threshold: string;
  }) => string;
  /** The bar's name once a tier has taken every milestone it has. */
  readonly barDone: (plural: string) => string;
}

/**
 * Reset copy. Clear first, in voice second.
 *
 * A player must not be able to misread what they are about to lose, so `clears`,
 * `keeps` and `confirmBody` name the losses outright and take no liberties.
 */
export interface PrestigeCopy {
  readonly name: string;
  readonly action: string;
  /** The claim, once there is a count to put on it. */
  readonly claim: (souls: string) => string;
  /** The claim while nothing is owed. Short, because the button is dead. */
  readonly noneOwed: string;
  readonly what: string;
  readonly worth: (perSoul: string) => string;
  /** Stat label over the soul count. */
  readonly held: string;
  /** Stat label over the multiplier. `share` arrives formatted, e.g. "2%". */
  readonly favour: (share: string) => string;
  /** Stat label over what a reset would pay out now. */
  readonly reckoning: string;
  readonly clears: string;
  /** Heading over `clears`. */
  readonly clearsTitle: string;
  readonly keeps: string;
  /** Heading over `keeps`. */
  readonly keepsTitle: string;
  /** Shown once souls are owed and the player has not taken them. */
  readonly available: string;
  readonly unavailable: string;
  readonly nextAt: (lifetimeEvil: string) => string;
  /** Term beside how long the current run has lasted. */
  readonly runLength: string;
  /** Term beside the estimated wait for one more soul. */
  readonly nextSoul: string;
  /**
   * Said in place of an estimate when the wait cannot be named.
   *
   * That covers two different situations and the panel cannot tell them apart: no
   * tier is turning on its own, or the run is old enough that `soulsEarned` and its
   * inverse no longer round-trip through `Decimal` at the same value (past roughly
   * 1e35 lifetime Evil this is the *common* case, not the rare one — see
   * `msToNextSoul`). The line has to be honest under both readings without claiming a
   * cause the player cannot act on, so it says only that the wait is not knowable,
   * never that nothing is happening.
   */
  readonly nextSoulUnknown: string;
  readonly confirmTitle: string;
  readonly confirmBody: (souls: string) => string;
  readonly confirmAction: string;
  readonly cancel: string;
  readonly claimed: (souls: string) => string;
  /** Held in the panel's slot before souls are anywhere in reach. */
  readonly locked: string;
  /** The notice that leads a first-time player to the panel. */
  readonly owed: string;
  /** That notice's control. */
  readonly owedAction: string;
}

export interface OfflineCopy {
  readonly heading: string;
  readonly summary: (duration: string) => string;
  /** Used instead of `summary` when the absence outran the offline cap. */
  readonly capped: (cap: string) => string;
  /** Used when the player owns nothing that produces. */
  readonly nothing: string;
  readonly dismiss: string;
}

/** One Minion and nothing else. The first screen every player sees. */
export interface EmptyCopy {
  readonly heading: string;
  readonly body: string;
  readonly action: string;
  readonly hint: string;
}

export interface RailCopy {
  /** The panel's own name. */
  readonly title: string;
  /** Names the run of generators to anyone who cannot see it laid out. */
  readonly list: string;
  /** Sits on the one row a panel names as a goal, and only when nothing there is affordable. */
  readonly saving: string;
  readonly locked: string;
  readonly lockedHint: string;
  /** The count on a row. `count` arrives formatted. */
  readonly held: (count: string) => string;
  /** The buy button, spoken in full. Every part arrives formatted. */
  readonly buy: (args: {
    readonly count: string;
    readonly tier: string;
    readonly cost: string;
  }) => string;
  /** Said when a row cannot be afforded yet. `amount` arrives formatted. */
  readonly shortfall: (amount: string) => string;
  readonly quantity: string;
  /** Names one numeric quantity option. `count` arrives formatted. */
  readonly quantityOption: (count: string) => string;
  readonly max: string;
  readonly maxHint: string;
  readonly cost: (amount: string) => string;
  /** Heading over the one named row for the tier the player has not reached. */
  readonly upcomingTitle: string;
  /** That row's line. Both parts arrive formatted; `tier` is the plural. */
  readonly upcoming: (args: { readonly tier: string; readonly cost: string }) => string;
  /**
   * Said beside the owned count when the two differ. `count` arrives formatted.
   *
   * Only when they differ. A row where every unit was bought would be saying the
   * same number twice, and the line is there to explain a price, not to decorate.
   */
  readonly bought: (count: string) => string;
  /**
   * Added to the lifted control's spoken name, never shown.
   *
   * On screen the state is carried by weight — the lifted control is filled where every
   * other is outlined, which survives greyscale and needs no word. This is the same fact
   * for anyone reading by ear.
   */
  readonly lifted: string;
  /** Added to a shut tab's spoken name when that panel holds something affordable. */
  readonly waiting: string;
}

/**
 * The manual layer: rousing a tier by hand, and hiring somebody so you need not.
 *
 * `names` are the Overseers themselves, fixed by spec §5.6. `notes` are one line each
 * on what that Overseer does with the job once they have it.
 */
export interface OverseerCopy {
  /** Section label on a rail row. */
  readonly title: string;
  /** The rouse button. `tier` is the plural. */
  readonly rouse: (tier: string) => string;
  /** Spoken label while a manual cycle is already running. */
  readonly running: (tier: string) => string;
  /** The hire button. `name` is the Overseer's title. */
  readonly appoint: (name: string) => string;
  /** Shown once hired. */
  readonly appointed: (name: string) => string;
  /** One line under a tier nobody oversees. */
  readonly manual: string;
  /** One line under a tier somebody does. */
  readonly automatic: string;
  /** What appointing costs. `amount` arrives formatted. */
  readonly cost: (amount: string) => string;
  readonly names: Readonly<Record<OverseerId, string>>;
  readonly notes: Readonly<Record<OverseerId, string>>;
  /**
   * What a post's effect does, stated plainly enough that a player can weigh the
   * spend against the price. Keyed by `effect.kind` rather than by `OverseerId` — the
   * mechanical fact is the same shape for every post of a kind, so this derives one
   * line per post from `OverseerDef.effect` instead of authoring fifteen that could
   * drift from what the post actually does. `factor` arrives already formatted, e.g.
   * "2".
   */
  readonly effect: {
    readonly automate: string;
    readonly quicken: (factor: string) => string;
    readonly swell: (factor: string) => string;
  };
  /** The panel these appointments live in, beside the muster. */
  readonly panelTitle: string;
  /** One line saying what the panel is for. */
  readonly what: string;
  /** Said where no post can be filled yet. */
  readonly none: string;
  /** Heading of the sheet that asks before spending. `name` is the Overseer's title. */
  readonly confirmTitle: (name: string) => string;
  readonly confirmAction: string;
  readonly cancel: string;
  /** Marks a post already filled, in a list. */
  readonly filled: string;
  /** Marks one that cannot be afforded yet. */
  readonly beyond: string;
}

/**
 * The chain diagram.
 *
 * Nothing on the stage is an action, so every string here names or describes. Its
 * sealed rung gets its own line rather than borrowing `rail.locked` and
 * `rail.lockedHint`: the rail shows a heading and a hint the player reads, the stage
 * shows an empty node whose only text is the name a screen reader speaks.
 */
export interface StageCopy {
  /** Names the whole diagram. */
  readonly chain: string;
  /** Names a rung the player has not reached. */
  readonly sealed: string;
  /** The ring's spoken value. `swept` arrives formatted, e.g. "50%". */
  readonly cycle: (args: { readonly label: string; readonly swept: string }) => string;
}

export interface DeedsCopy {
  readonly title: string;
  readonly what: string;
  readonly none: string;
  readonly unearned: string;
  readonly progress: (earned: string, total: string) => string;
}

export interface LedgerCopy {
  readonly title: string;
  readonly lifetimeEvil: string;
  readonly smites: string;
  readonly resets: string;
  readonly deeds: string;
  readonly soundOn: string;
  readonly soundOff: string;
  readonly exportAction: string;
  readonly exportDone: string;
  readonly importAction: string;
  readonly importDone: string;
  readonly blobLabel: string;
  readonly blobPlaceholder: string;
  readonly abdicate: string;
  readonly abdicateTitle: string;
  readonly abdicateBody: string;
  readonly abdicateCancel: string;
  readonly abdicateConfirm: string;
  readonly abdicated: string;
}

/**
 * Failure text.
 *
 * The first seven names match the engine's `IntentFailure` members and the last four
 * its save errors. They are spelled out rather than imported: content sits below the
 * engine and may not depend on it.
 */
export interface ErrorCopy {
  readonly insufficientResource: string;
  readonly nothingAffordable: string;
  readonly noSoulsEarned: string;
  readonly unknownTier: string;
  readonly tierNotOwned: string;
  readonly alreadyRunning: string;
  readonly alreadyAppointed: string;
  readonly corruptSave: string;
  readonly unmigratableSave: string;
  /** Shown when a save predates the supported floor and cannot be brought forward. */
  readonly obsoleteSave: string;
  readonly storageBlocked: string;
}

/**
 * One of her lines, and the Apathy above which she says it.
 *
 * The threshold sits beside the sentence rather than in `v1/onboarding.ts` because it
 * paces prose, not the economy, and splitting a threshold from the line it chooses is
 * the easiest way to let the two drift.
 *
 * The list is **total**: entries run in descending order, selection takes the first
 * whose threshold Apathy exceeds, and the last threshold is negative so it always
 * matches. There is no fallback branch, and so none to leave untested.
 */
export interface GoadLine {
  readonly aboveApathy: number;
  readonly line: string;
}

/**
 * The first run, and the voice that interrupts it.
 *
 * Body text only — no titles. A standing order, not a card. The one place the shipped
 * tour's five titled cards survive is in what this replaced.
 */
export interface OnboardingCopy {
  /** Leaves both tracks for good. Offered on the opening beat and nowhere else. */
  readonly skip: string;
  /** Opens the Musings screen, which already holds Import. */
  readonly loadSave: string;
  /** Closes a beat that gates nothing. */
  readonly dismiss: string;
  /** Names the bar to a screen reader when the narrator holds it. */
  readonly narratorLabel: string;
  /** And when she does. */
  readonly herLabel: string;
  readonly dominion: Readonly<Record<DominionBeatId, string>>;
  readonly malice: {
    readonly 'first-blow': string;
    readonly apathy: string;
  };
  readonly goad: readonly GoadLine[];
}

export interface Copy {
  readonly title: string;
  /** Shuts any record lifted over the game. Chrome, so plain rather than in voice. */
  readonly close: string;
  readonly evil: ResourceCopy;
  readonly tiers: Readonly<Record<TierId, TierCopy>>;
  readonly achievements: Readonly<Record<AchievementId, AchievementCopy>>;
  readonly smite: SmiteCopy;
  readonly malice: MaliceCopy;
  readonly milestone: MilestoneCopy;
  readonly prestige: PrestigeCopy;
  readonly offline: OfflineCopy;
  readonly empty: EmptyCopy;
  readonly rail: RailCopy;
  readonly overseer: OverseerCopy;
  readonly stage: StageCopy;
  readonly deeds: DeedsCopy;
  readonly ledger: LedgerCopy;
  readonly errors: ErrorCopy;
  readonly onboarding: OnboardingCopy;
}
