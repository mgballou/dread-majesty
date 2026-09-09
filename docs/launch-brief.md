# Launch Brief

**Written 2026-08-20.** Everything needed to write the r/incremental_games post, gathered
so the writing is the only work left. The writing, the voice, the title and the timing are
Matthew's, and nothing here decides any of them. Companion to the state-of-play briefing on
the unmerged `docs/state-of-play` branch, which argued that this post is the one next step.

---

## 1. Checked tonight, not remembered

Every line here was run, not recalled.

- **What is live is this code.** The deployed page names `assets/index-BoaVPUgB.js` and
  `assets/index-BK8Ae0GL.css`; a fresh `pnpm build` off `main` produces those same two
  fingerprints. Nothing is stale on the server.
- **`pnpm build` passes.** 126 modules, 349 kB of JS — 105.6 kB gzipped — and 41.5 kB of
  CSS, 7.5 kB gzipped.
- **The dev workbench really is gone from the shipped bundle.** `DevPanel` appears nowhere
  in `apps/web/dist`.
- **The harness agrees with the README to the second.** Warrens 10m57s, Dark Legions
  40m35s, Fortresses 1h22m53s, Thrones 2h29m37s, first prestige 42m13s. Prestige settles:
  final step ratio 1.065, decelerating. 19 of 28 achievements land inside seven days.
- **The live site answers 200 and logs nothing.** Zero console errors and zero warnings
  across load, title screen and the first prompt.
- **The first minute works on a cold browser.** Title card → the lackey prompt → *Rouse the
  Minions*, with *Skip tutorial* and *Load save* both offered on the same screen.

## 2. On a phone

That subreddit reads on phones, so this was checked at 390×844 rather than assumed.

- It renders, and the page does not scroll sideways — document width is exactly the
  viewport's 390.
- The chain is a scroll track of its own, 201 px wide inside that 390, holding about one
  node on screen and already scrolled to the tier that matters. It works; it is tight.
- Title card, tour prompt and buy rail all fit without clipping.
- The manifest installs to a home screen — standalone, portrait — but **there is no service
  worker**, so an installed copy still needs the network to start. Do not claim offline play.
- Not checked: iOS Safari specifically, and any session longer than a few minutes.

## 3. Facts a post can stand on

Free, in a browser, no account, no ads, nothing to buy. Saves live in IndexedDB and export
as a blob you can paste somewhere safe. Sound is synthesized in code and stays muted until
asked for. Five tiers, each one bought manual and automated later by appointing its
Overseer. Roughly 42 minutes to the first prestige.

Two things a reader will notice before you tell them, so tell them first: **every art slot
is a generated SVG placeholder**, and **the source is readable but carries no license** —
all rights reserved.

## 4. What to ask them

The state-of-play briefing lists four questions the harness cannot answer: whether the
30m→1h stretch reads as payoff or as a wall, whether the tour teaches or nags, whether
Malice is funny or an interruption, and whether 42 minutes to first prestige is right.

All four are worth knowing. A post that asks four gets answers to none — pick two.

## 5. The subreddit's own rules — read them yourself

This agent cannot reach reddit.com; both `www` and `old` are blocked here, so nothing about
the rules is quoted or paraphrased below. Confirm on the sidebar before posting:

- whether a post flair is required, and which one fits a browser game's first showing
- how the sub handles a developer posting their own game — a rate limit, a required tag, or
  a weekly thread that is the expected home for a first post
- the link rules (referral links are banned outright; a plain Netlify link is not one)

## 6. What the comments will bring

- **"What license?"** Have the answer written before you post, not typed at midnight.
- **"Placeholder art."** Named in the post, this costs nothing. Unnamed, it leads.
- **"Does it work on mobile?"** Yes — the chain scrolls. Section 2 is the honest version.
- **"Is this AI-made?"** The repo makes the whole process legible. Whether that is the lede,
  a footnote or absent is a voice decision, not a fact.
- **Load.** A static Netlify page with no server behind it. There is nothing to fall over.

## 7. Pictures

`docs/assets/board.png`, `title.png` and `tour.png` are current and all three ship in the
README. There is no moving capture of anything. The cascade is a motion idea and a still
photograph undersells it — ten seconds of a Warren delivering Minions unasked would carry
the post better than any paragraph. That is the one asset worth making first, and it needs
somebody to play.

## 8. Left open on purpose

The post's title, its voice, when it goes up, which two questions it asks, and whether it
links the repo at all.
