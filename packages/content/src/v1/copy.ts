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
    throne: {
      flavour:
        'Commands the raising of Fortresses. Nobody has seen the seat empty in a generation.',
    },
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

    'throne-1': {
      name: 'The High Seat',
      description: 'Own a Throne. It fits exactly one, and everyone insists it is you.',
    },
    'throne-25': {
      name: 'A Court of Chairs',
      description: 'Own 25 Thrones. Nobody has settled who outranks whom.',
    },
    'throne-200': {
      name: 'The Waiting List',
      description: 'Own 200 Thrones. Succession is now a career.',
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

    'souls-500': {
      name: 'First Damnation',
      description: 'Hold 500 Damned Souls. They are smaller than you expected.',
    },
    'souls-3000': {
      name: 'A Full Drawer',
      description: 'Hold 3,000 Damned Souls. You file them by date.',
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
    spoken: (amount, band) => `Smite. You hold ${amount} Evil. ${band}`,
    cooling: 'Soon',
    ready: 'Enact your will',
    reigning: 'All shall kneel',
    until: (seconds) => `${seconds} til ready`,
    worth: ({ multiplier, seconds }) => `Everything works ${multiplier} as hard for ${seconds}.`,
    results: [
      'A village, and the road to it.',
      'One shrine, put down personally.',
      'A bridge, taken down at both ends.',
      'An orchard, salted.',
      'Struck. The report will follow.',
    ],
    bands: [
      'The realm flinches.',
      'The realm has seen worse.',
      'The realm has stopped looking.',
    ] as const,
  },

  malice: {
    title: 'Malice',
    names: {
      reach: 'Reach',
      weight: 'Weight',
      forgetting: 'Forgetting',
      restraint: 'Restraint',
    },
    notes: {
      reach: 'A blow that holds longer. The realm has more time to regret it.',
      weight: 'A heavier blow. Nothing subtle, and nothing that needs to be.',
      forgetting: 'The realm forgets your last blow sooner, and fears the next one more.',
      restraint: 'Each measure of Apathy takes less off a blow. Discipline, of a sort.',
    },
    rung: ({ at, of }) => `Rung ${at} of ${of}`,
    step: ({ now, next }) => `${now} → ${next}`,
    climb: 'Climb',
    climbCost: (cost) => `${cost} Evil`,
    keep: 'Keep',
    keepCost: (cost) => `${cost} souls`,
    maxed: 'Mastered',
    held: 'Held',
    lifted: 'best available',
  },

  milestone: {
    name: 'Milestone',
    what: 'Past a certain number, they work faster. Nobody knows why.',
    bar: ({ remaining, plural, multiplier, threshold }): string =>
      `${remaining} more ${plural} for ${multiplier} output at ${threshold}.`,
    barDone: (plural: string): string =>
      `Every milestone taken. The ${plural} will not make more than this.`,
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
    clears:
      'Your Evil, everything you have built, every Overseer, every milestone, and every rank you did not buy with souls.',
    clearsTitle: 'Taken from you',
    keeps: 'Your souls, your deeds, the tiers you have seen, and the ranks you bought with souls.',
    keepsTitle: 'Left to you',
    available: 'The souls are yours whenever you are done. There is no undoing it.',
    unavailable: 'You have not done enough to be owed a soul.',
    nextAt: (lifetimeEvil: string): string =>
      `The next soul comes at ${lifetimeEvil} lifetime Evil.`,
    runLength: 'This reign',
    nextSoul: 'Next soul in',
    nextSoulUnknown: 'Beyond reckoning',
    confirmTitle: 'Claim and begin again?',
    confirmBody: (souls: string): string =>
      `You take ${souls} Damned Souls and start from nothing. Your souls, your deeds, the tiers you have seen, and the ranks you bought with souls stay. Your Evil, every Throne, Fortress, Legion, Warren and Minion, every Overseer, every milestone, and every rank you did not buy with souls go.`,
    confirmAction: 'Claim and begin again',
    cancel: 'Not yet',
    claimed: (souls: string): string => `${souls} Damned Souls. The realm starts again.`,
    locked: 'Inflict further suffering.',
    owed: 'The realm owes you souls.',
    owedAction: 'Go and count them',
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
    title: 'Muster',
    list: 'What you can raise',
    saving: 'Save toward this',
    locked: 'Not yet known',
    lockedHint: 'You have not come this far yet.',
    held: (count: string): string => `${count} held`,
    buy: ({ count, tier, cost }: { count: string; tier: string; cost: string }): string =>
      `Buy ${count} ${tier} for ${cost}`,
    shortfall: (amount: string): string => `Short ${amount} Evil`,
    quantity: 'Buy quantity',
    quantityOption: (count: string): string => `Buy ${count} at a time`,
    max: 'Max',
    maxHint: 'Buy as many as you can afford.',
    cost: (amount: string): string => `${amount} Evil`,
    upcomingTitle: 'Next in the chain',
    upcoming: ({ tier, cost }: { tier: string; cost: string }): string =>
      `${tier} cost ${cost}. Further than you have come.`,
    bought: (count: string): string => `${count} bought — the price follows this`,
    lifted: 'best available',
    waiting: 'something to spend on',
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
      'throne-hand': 'Steward of the High Seat',
      'throne-goad': 'Keeper of the Long Hour',
      'throne-glut': 'Chancellor of Titles',
      'fortress-hand': 'Castellan of the Black Keep',
      'fortress-goad': 'Overseer of the Scaffold',
      'fortress-glut': 'Master of the Quarry',
      'legion-hand': 'Quartermaster of the Host',
      'legion-goad': 'Marshal of the Forced March',
      'legion-glut': 'Herald of the Levy',
      'warren-hand': 'Warden of the Warrens',
      'warren-goad': 'Mistress of the Quickening',
      'warren-glut': 'Broodkeeper',
      'minion-hand': 'Taskmaster of the Pits',
      'minion-goad': 'Keeper of the Whip',
      'minion-glut': 'Reckoner of the Tally',
    },
    notes: {
      'throne-hand': 'Keeps the seat warm, the arch propped, and the succession vague.',
      'throne-goad': 'Has adjusted the calendar. Nobody has noticed and nobody will.',
      'throne-glut': 'Grants a dominion to anyone who asks twice. They keep asking.',
      'fortress-hand': 'Holds every key in the Keep and sleeps with them. The building goes on.',
      'fortress-goad': 'Builds through the night by the light of the thing he is building.',
      'fortress-glut': 'Found more mountain. There was always more mountain.',
      'legion-hand': 'Moves the host, feeds it, and files the requisitions you never read.',
      'legion-goad': 'Has abolished the halt. Morale is described in the ledger as adequate.',
      'legion-glut': 'Every village yields twice what it says it has. He is very patient.',
      'warren-hand': 'Knows each door in the Warrens and which of them still shut.',
      'warren-goad': 'Halved the gestation and will not say how. The Warrens do not ask.',
      'warren-glut': 'Two to a bunk was always going to be an underestimate.',
      'minion-hand': 'Walks the pits at all hours. Keeps a tally, a whistle, and no friends.',
      'minion-goad': 'Believes deeply in punctuality. Has views on the value of a second.',
      'minion-glut': 'Found four more minions in a ledger nobody had read. They are working now.',
    },
    effect: {
      automate: 'Takes the cycle off your hands, for good. It will not need telling twice.',
      quicken: (factor: string): string =>
        `Runs the cycle ${factor}× as fast. Whatever that costs, it isn't billed to you.`,
      swell: (factor: string): string =>
        `Delivers ${factor}× the take. Nobody has asked where the extra came from.`,
    },
    panelTitle: 'Miscreants',
    what: 'Promoted for enthusiasm. They keep the work moving while you are elsewhere.',
    none: 'Nobody has done anything worth promoting yet.',
    confirmTitle: (name) => `Appoint ${name}?`,
    confirmAction: 'Appoint',
    cancel: 'Not yet',
    filled: 'Appointed',
    beyond: 'Beyond you',
  },

  stage: {
    chain: 'The chain of production',
    sealed: 'A rung you have not reached yet',
    cycle: ({ label, swept }: { label: string; swept: string }): string =>
      `${label}: ${swept} through its cycle`,
  },

  deeds: {
    title: 'Misdeeds',
    what: 'What the realm remembers you for.',
    none: 'Nothing recorded yet.',
    unearned: 'Not yet done.',
    progress: (earned: string, total: string): string => `${earned} of ${total}`,
  },

  ledger: {
    title: 'Musings',
    lifetimeEvil: 'Lifetime Evil',
    smites: 'Smites',
    resets: 'Resets',
    deeds: 'Misdeeds recorded',
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
    obsoleteSave:
      'This save is from an early development build and no longer loads. Starting fresh.',
    storageBlocked: 'This browser will not let the game save. Close the tab and it is gone.',
  },

  onboarding: {
    skip: 'Skip tutorial',
    loadSave: 'Load save',
    dismiss: 'Understood',
    narratorLabel: 'A word of advice',
    herLabel: 'She has something to say',
    dominion: {
      stir: 'One Minion, big dreams, and the favor of an otherworldly abomination. Set it about some wickedness.',
      orders:
        'Once they finish a task, they await further orders. Initiative seems a rare quality.',
      muster: 'One is not a host. Evil buys more of them, and more of them is more Evil.',
      appoint: 'Perhaps with enough Evil you can set someone about managing this for you.',
      warren: 'Take ground of your own. A Warren breeds Minions without being asked.',
      'rouse-warren': 'It will not start itself. They never do.',
      cascade:
        'Five Minions you did not raise, already at work. Everything above feeds what is below it, all at once. The rest is yours.',
    },
    malice: {
      'first-blow':
        'I knew it would not take long for you to take matters into your own hands. When you strike, the dark force in you runs through the ranks and everything works harder for a while. Try not to overdo it.',
      apathy: 'You listened to her. Everyone does, once. Let them rest and the fear returns.',
    },
    // Descending, and the last entry always matches. She flatters, then reads the
    // resistance and renames it weakness, then stops pushing and gets intimate — and
    // then she is simply correct, which is the only honest thing she says and the most
    // persuasive. See the spec §5.2.
    goad: [
      {
        aboveApathy: 0.45,
        line: "Oh, that was good. Again — while they are still trembling. Don't let them settle.",
      },
      {
        aboveApathy: 0.2,
        line: 'You are being careful. I do like that in you. But careful is not the same as strong.',
      },
      {
        aboveApathy: 0,
        line: "No? Then I'll wait with you. I have nothing else. Neither, in the end, do you.",
      },
      {
        aboveApathy: -1,
        line: 'There. They have forgotten you entirely. That is the moment — take it, and take all of it.',
      },
    ],
  },
} as const satisfies Copy;
