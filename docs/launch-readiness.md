# Launch Readiness

**Written 2026-08-25.** A review of the launch brief on `docs/launch-brief` and the game it
would point at, against the question asked on 24 August: *"review the launch brief for me,
but i dont know if im ready to post it on incremental games."* That is two questions. They
are kept apart below. Nothing here decides whether to post.

**Verdict: not yet, because there is no post yet and the first two minutes are 32 taps of a
four-second cooldown before anything can be bought.**

---

## One: is the post ready

**There is no post.** The launch brief is materials, and it says so — its own §8 leaves the
title, the voice, the timing, which two questions it asks and whether it links the repo
"open on purpose." Every one of those is the post. The brief closes the fact-gathering and
opens nothing else, so "is the post ready" has no subject yet.

The three things a launch post on that subreddit carries, checked rather than read off the
brief:

- **A playable link — yes.** `https://dreadmajesty.netlify.app` answered 200. Loaded in a
  browser at 390×844 it renders: title card, chain, buy rail, four tabs, the advice bar.
- **Screenshots — three exist, and one of them carries a post.** `board.png` is the game:
  the chain populated, 48B Evil, the buy rail with real numbers. `title.png` and `tour.png`
  are the same frame — 1 Minion, 0 Evil, most of the screen black — and `title.png` is
  `tour.png` with the title modal laid over it. So two of the three show an empty game, and
  the third is clipped at the bottom through the Dark Legions row mid-sentence. All three
  are very dark; as a Reddit thumbnail they read as a black rectangle.
- **A one-line hook — yes, and it is in the game, not in the brief.** The title card says
  *"You are a Dark Lord. One Minion, big dreams, and the favor of an otherworldly
  abomination."* That is the line. The brief never names it as the hook and §8 leaves the
  title open, so the post would be written without noticing the game already solved this.
- **A moving capture — missing.** The brief's §7 already says it and it is right: the
  cascade is a motion idea and no still sells it. Ten seconds of a Warren delivering
  Minions unasked is the one asset worth making, and it needs somebody to play.

**The subreddit's own rules are still unread, and now by two agents.** The brief's §5 says
reddit.com was blocked for the agent that wrote it. It is blocked here too: `old.reddit.com`
is refused outright, `www.reddit.com/r/incremental_games/about/rules.json` returns 403, and
a domain-restricted search is refused at the API. Secondary sources give fragments only —
no referral links, spam is removed and spammers banned, games made with Idle Game Maker are
not permitted, and Rule 1A concerns requests for help finding games. **Flair, the policy on
a developer posting their own game, and whether a first showing has a designated thread are
all still unconfirmed.** No agent is going to close this. It is a sidebar he has to open.

## Two: is the game ready

Played on the live build at 390×844, from a cold browser with no save. Hardest first.

1. **The first two minutes are two minutes of tapping a cooldown.** One click of *Rouse the
   Minions* yields 5 Evil. Ten seconds later it is still 5 — nothing accrues on its own, and
   the header reads `0 Evil per second` throughout. The second Minion costs **160 Evil**. At
   five a cycle on a four-second cooldown that is 32 taps and about **2 minutes 8 seconds**
   before the first purchase is possible. The state-of-play briefing asks whether the
   30m→1h stretch reads as a wall. **The wall a stranger meets is at second zero**, and an
   incremental that does not increment inside the first two minutes is asking a scrolling
   reader for more patience than a Reddit link is given.
2. **The advice bar empties at the moment the player is asked to act.** Before *Start Game*
   the `role="status"` region reads *"A trusted lackey who will do your bidding. Set it
   about some wickedness."* After *Start Game* it is empty, and it stayed empty across a
   rouse and ten more seconds. Whether that is a beat waiting on a threshold or a prompt
   that dropped, the effect is the same: the tutorial's one line of guidance disappears
   exactly when it is needed.
3. **The buy rail is greyed on arrival and stays greyed for those two minutes.** The one
   control that looks like progress is disabled the whole time the player is working
   towards it.
4. **The board is nearly empty and stays that way.** Two nodes show — Warrens dimmed,
   Minions at 1. The cascade is the whole point of the interface and the second rung costs
   3K Evil, which is a long way past 160. Nothing a first-timer sees demonstrates the idea
   the post would be selling.
5. **Not checked, and worth naming rather than assuming.** iOS Safari specifically; any
   session past a few minutes; whether the nine achievements a seven-day simulation never
   earns are reachable at all. The brief's §2 already declines the first two.

None of this is a defect and none of it contradicts the state-of-play briefing. The engine
is sound — 1,325 tests, a harness that agrees with the README to the second, a clean tree
and a green build. This is a first-two-minutes problem. It is also the only part of the
game a reader arriving from a link is guaranteed to see.

---

## What is left for him

Recorded as decision 60 in the Laila vault: whether the opening two minutes are what he
wants a stranger to meet, or whether they change before the post goes up.
