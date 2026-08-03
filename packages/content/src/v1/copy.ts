import type { Copy } from '../copy.ts';

/**
 * The writing.
 *
 * False grimdark: the gothic played straight, and an earnest dark lord who takes the
 * work seriously. The comedy is the gap between that and the administration — the
 * rosters, the payroll, the guild the masons formed. Nothing here nods at the
 * audience, nothing is funny about being a game, and no line is funny in two places
 * at once: where the shape is dry the content is straight, and where the content is
 * absurd the delivery is flat.
 *
 * `as const satisfies Copy` rather than an annotation, so the literal types survive
 * while the compiler still forces every key to exist.
 */
export const v1Copy = {
  title: 'Dread Majesty',
  close: 'Close',

  evil: {
    name: 'Evil',
    flavour: 'Harm, rendered down and counted.',
  },

  tiers: {
    fortress: {
      flavour: 'Raises Dark Legions. Black stone, stabling for four thousand.',
    },
    legion: {
      flavour: 'Takes ground and holds it. Paid on the first of the month.',
    },
    warren: {
      flavour: 'Built on ground the legions took. Damp, crowded, breeding well.',
    },
    minion: {
      flavour: 'Bred in the Warrens, put to work by morning.',
    },
  },

  achievements: {
    'minion-10': {
      name: 'Ten Names',
      description: 'Own 10 Minions. You know each of them.',
    },
    'minion-100': {
      name: 'Assigned Numbers',
      description: 'Own 100 Minions. You gave up on names.',
    },
    'minion-500': {
      name: 'A Clerk Appointed',
      description: 'Own 500 Minions. Somebody has to keep the list.',
    },
    'minion-2500': {
      name: 'Standing Room',
      description: 'Own 2,500 Minions. Nobody has seen the floor in weeks.',
    },

    'warren-1': {
      name: 'A Roof of Sorts',
      description: 'Own a Warren. It leans, but it holds.',
    },
    'warren-25': {
      name: 'A Street',
      description: 'Own 25 Warrens. They lean over the road from both sides.',
    },
    'warren-200': {
      name: 'The Map Is Wrong',
      description: 'Own 200 Warrens. Nobody has surveyed the far end.',
    },

    'legion-1': {
      name: 'Mustered',
      description: 'Own a Dark Legion. Twelve thousand, all of them hungry.',
    },
    'legion-25': {
      name: 'The Long Column',
      description: 'Own 25 Dark Legions. They take three days to pass.',
    },
    'legion-200': {
      name: 'Uncounted',
      description: 'Own 200 Dark Legions. No two counts have agreed.',
    },

    'fortress-1': {
      name: 'Black Stone',
      description: 'Own a Fortress. Four years, and most of a forest.',
    },
    'fortress-25': {
      name: 'A Crowded Horizon',
      description: 'Own 25 Fortresses. There is nowhere left to look without one.',
    },
    'fortress-200': {
      name: 'A Continent Roofed',
      description: 'Own 200 Fortresses. The masons have formed a guild.',
    },

    'evil-1e3': {
      name: 'A Thousand Slights',
      description: 'Earn 1,000 Evil in all. Mostly small, mostly local.',
    },
    'evil-1e6': {
      name: 'A Second Volume',
      description: 'Earn 1,000,000 Evil in all. One book was not enough.',
    },
    'evil-1e12': {
      name: 'Archived',
      description: 'Earn a trillion Evil in all. The record needs its own building.',
    },
    'evil-1e20': {
      name: 'Taken On Trust',
      description: 'Earn a hundred quintillion Evil in all. The clerks stopped counting.',
    },

    'souls-1': {
      name: 'First Damnation',
      description: 'Hold a Damned Soul. It is smaller than you expected.',
    },
    'souls-100': {
      name: 'A Full Drawer',
      description: 'Hold 100 Damned Souls. You file them by date.',
    },
    'souls-10000': {
      name: 'A Low Sound',
      description: 'Hold 10,000 Damned Souls. In a quiet room you can hear them.',
    },

    'prestige-1': {
      name: 'Begun Again',
      description: 'Claim souls once. It cost you everything you had built.',
    },
    'prestige-10': {
      name: 'A Working Method',
      description: 'Claim souls 10 times. You have stopped mourning the buildings.',
    },

    'smite-1': {
      name: 'By Your Own Hand',
      description: 'Smite once. It was quicker than explaining.',
    },
    'smite-100': {
      name: 'A Habit',
      description: 'Smite 100 times. It is how the day starts.',
    },
    'smite-1000': {
      name: 'Never Delegated',
      description: 'Smite 1,000 times. You trust nobody else with it.',
    },
  },

  smite: {
    action: 'Smite',
    hint: 'Do it yourself. It is not beneath you.',
    spoken: (amount) => `Smite. You hold ${amount} Evil.`,
    results: [
      'A village, and the road to it.',
      'One shrine, put down personally.',
      'A bridge, taken down at both ends.',
      'An orchard, salted.',
      'Struck. The report will follow.',
    ],
  },

  milestone: {
    name: 'Milestone',
    what: 'Past a certain number, they work faster. Nobody knows why.',
    next: ({
      remaining,
      plural,
      multiplier,
      threshold,
    }: {
      remaining: string;
      plural: string;
      multiplier: string;
      threshold: string;
    }): string => `${remaining} more ${plural} for ${multiplier} output at ${threshold}.`,
    done: 'Every milestone taken.',
    noMore: 'They will not make more than this.',
  },

  prestige: {
    name: 'Damned Souls',
    action: 'Claim souls',
    claim: (souls: string): string => `Claim ${souls} Damned Souls`,
    noneOwed: 'No souls owed yet',
    what: 'What your work is worth, once you stop and count it.',
    worth: (perSoul: string): string =>
      `Each soul adds ${perSoul} to everything you make. It never goes away.`,
    held: 'Souls held',
    favour: (share: string): string => `Their favour, at ${share} each`,
    reckoning: 'A reckoning now would owe',
    clears: 'Your Evil, everything you have built, and every milestone.',
    clearsTitle: 'Taken from you',
    keeps: 'Your souls, your deeds, and everything you have unlocked.',
    keepsTitle: 'Left to you',
    available: 'The souls are yours whenever you are done. There is no undoing it.',
    unavailable: 'You have not done enough to be owed a soul.',
    nextAt: (lifetimeEvil: string): string =>
      `The next soul comes at ${lifetimeEvil} lifetime Evil.`,
    confirmTitle: 'Claim and begin again?',
    confirmBody: (souls: string): string =>
      `You take ${souls} Damned Souls and start from nothing. Your souls, your deeds and everything you have unlocked stay. Your Evil, every Fortress, Legion, Warren and Minion, and every milestone go.`,
    confirmAction: 'Claim and begin again',
    cancel: 'Not yet',
    claimed: (souls: string): string => `${souls} Damned Souls. The realm starts again.`,
  },

  offline: {
    heading: 'In your absence',
    summary: (duration: string): string => `${duration} of work, done without you.`,
    capped: (cap: string): string =>
      `They worked ${cap}, then stopped. You had not told them to continue.`,
    nothing: 'Nothing happened. There was nobody to do it.',
    dismiss: 'Back to it',
  },

  empty: {
    heading: 'One Minion',
    body: 'No walls, no army, no ground. That is what the first one is for.',
    action: 'Smite',
    hint: 'It makes Evil. Evil buys the second Minion.',
  },

  rail: {
    title: 'The Levy',
    list: 'What you can raise',
    best: 'Advised',
    saving: 'Save toward this',
    locked: 'Not yet known',
    lockedHint: 'You have not come this far yet.',
    held: (count: string): string => `${count} held`,
    cycle: (tier: string): string => `${tier} cycle`,
    buy: ({ count, tier, cost }: { count: string; tier: string; cost: string }): string =>
      `Buy ${count} ${tier} for ${cost}`,
    affordable: 'Affordable',
    shortfall: (amount: string): string => `Short ${amount} Evil`,
    quantity: 'Buy quantity',
    quantityOption: (count: string): string => `Buy ${count} at a time`,
    max: 'Max',
    maxHint: 'Buy as many as you can afford.',
    cost: (amount: string): string => `${amount} Evil`,
    upcomingTitle: 'Next in the chain',
    upcoming: ({ tier, cost }: { tier: string; cost: string }): string =>
      `${tier} cost ${cost}. Further than you have come.`,
  },

  overseer: {
    title: 'Oversight',
    rouse: (tier: string): string => `Rouse the ${tier}`,
    running: (tier: string): string => `The ${tier} are at work`,
    appoint: (name: string): string => `Appoint the ${name}`,
    appointed: (name: string): string => `${name}, appointed. You will not be asked again.`,
    manual: 'Nobody is watching this. It moves when you say so.',
    automatic: 'Somebody is watching this. It moves without you.',
    cost: (amount: string): string => `${amount} Evil, once`,
    names: {
      fortress: 'Castellan of the Black Keep',
      legion: 'Quartermaster of the Host',
      warren: 'Warden of the Warrens',
      minion: 'Taskmaster of the Pits',
    },
    notes: {
      fortress: 'Holds every key in the Keep and sleeps with them. The building goes on.',
      legion: 'Moves the host, feeds it, and files the requisitions you never read.',
      warren: 'Knows each door in the Warrens and which of them still shut.',
      minion: 'Walks the pits at all hours. Keeps a tally, a whistle, and no friends.',
    },
  },

  stage: {
    chain: 'The chain of production',
    sealed: 'A rung you have not reached yet',
    cycle: ({ label, swept }: { label: string; swept: string }): string =>
      `${label}: ${swept} through its cycle`,
  },

  deeds: {
    title: 'Deeds',
    what: 'What the realm remembers you for.',
    none: 'Nothing recorded yet.',
    unearned: 'Not yet done.',
    progress: (earned: string, total: string): string => `${earned} of ${total}`,
  },

  ledger: {
    title: 'The ledger',
    lifetimeEvil: 'Lifetime Evil',
    smites: 'Smites',
    resets: 'Resets',
    deeds: 'Deeds recorded',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    exportAction: 'Export',
    exportDone: 'Copied out. Keep it somewhere dry.',
    importAction: 'Import',
    importDone: 'Restored.',
    blobLabel: 'Save text',
    blobPlaceholder: 'Paste a save here, or export one to read it out.',
    abdicate: 'Abdicate',
    abdicateTitle: 'Abdicate?',
    abdicateBody:
      'Everything goes: your Evil, everything you have built, every soul, every deed. There is no undo and no copy kept. Export first if you want a way back.',
    abdicateCancel: 'Keep the realm',
    abdicateConfirm: 'Abdicate',
    abdicated: 'The realm is dark again.',
  },

  errors: {
    insufficientResource: 'Not enough Evil.',
    nothingAffordable: 'Nothing you can afford.',
    noSoulsEarned: 'You have not done enough to be owed a soul.',
    unknownTier: 'No such thing.',
    tierNotOwned: 'You have none of those to rouse.',
    alreadyRunning: 'They are already at it.',
    alreadyAppointed: 'That post is filled.',
    corruptSave: 'That is not a save. Nothing changed.',
    unmigratableSave: 'That save is older than this build can read.',
    storageBlocked: 'This browser will not let the game save. Close the tab and it is gone.',
  },
} as const satisfies Copy;
