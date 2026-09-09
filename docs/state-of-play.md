# State of Play

**Written 2026-08-20.** A cold-start briefing after six quiet days. It records what was
true on that date and goes stale on the next commit — the three governing documents in
[`docs/README.md`](README.md) outrank it wherever they disagree.

---

## 1. What this is

Dread Majesty is an incremental game in a TypeScript monorepo: a pure engine, a content
package holding every number and every string, and a React app that renders engine state
and sends intents back. Fortresses raise Dark Legions, Legions take ground that becomes
Warrens, Warrens breed Minions, Minions make Evil — generators buying generators, so
production compounds, and showing that cascade is the whole point of the interface. The
tone is gothic played straight with an earnest protagonist, so the art never winks and
the joke lives in the writing and the numbers.

---

## 2. Where it stands

**It is a finished, playable game that is live on the web and has never been shown to a
player.** That sentence is the whole situation.

### Works

- **The engine.** Fixed-timestep simulation, exact cost curve and max-buy, purchases,
  manual cycles and Overseers, milestone and prestige multipliers, achievements, unlock
  latching, offline catch-up, ten versioned save migrations. 1,325 tests pass across 59
  files in 13 seconds.
- **The interface.** Not a shell: live chain diagram, buy rail with exactly one accented
  spend, prestige panel, deeds wall, ledger, offline-return screen, title screen. Saves
  go to IndexedDB and export as a pasteable blob. Sound is synthesized in code, muted
  until asked for.
- **Onboarding, both tracks.** Six gated beats plus a seventh that gates nothing and
  simply remarks on the cascade. Malice arrives on the first smite, and both of her
  endings are reachable.
- **The measuring rig.** `pnpm harness` simulates seven days and reports tier arrivals,
  obsolescence, the growth exponent and prestige convergence. Run today it reports
  `settled: yes`, a final prestige step ratio of 1.065, and tier arrivals matching the
  README to the second.
- **The build and the deploy.** `pnpm check` and `pnpm build` both pass locally, CI was
  green on the last push, and https://dreadmajesty.netlify.app answers 200.

### Half-built

- **Economy tuning.** Deliberately open. Warrens at 11m, Dark Legions at 41m, Fortresses
  at 1h23m, Thrones at 2h30m, first prestige at 42m. These are the best answer so far,
  not a finished one, and the harness has no more to say about them.
- **Art.** Every slot renders a generated SVG fallback. That was always the plan for
  now, and the fallbacks are good enough to ship the README on.
- **M5.** Half done. The public build exists and is live; nobody has been told about it.

### Not started, on purpose

Second Overseers bought with Souls, the offline-cap upgrade curve, and the whole M6
meta-plane (Tauri, Laravel, cloud save) — the last one conditional on traction that does
not yet exist. All three are pinned in the design spec §10 so they are not redesigned
from scratch later.

### Abandoned

The pre-code planning documents, which specified a server-authoritative Laravel engine
this project reversed. Deleted rather than left to be half-believed; what survived was
folded into the design spec. Nothing else has been abandoned — no dead directories, no
commented-out systems, no TODO or FIXME anywhere in `packages/` or `apps/`.

---

## 3. The one next step

**Post it to r/incremental_games.** The second half of M5, and the only work here whose
value is not already known.

Everything that remains open is a question only players can answer. Does the 30m→1h
cliff read as a payoff or a discontinuity? Does the tour teach, or does it nag? Does
Malice land as funny or as an interruption? Is 42 minutes to first prestige right? The
harness has been run to the end of its usefulness — it certifies that the economy is
internally sound, and it is structurally unable to say whether any of it is *fun*.

The competing candidates all lose to it for the same reason:

- **Real art** is the most visible gap, and it is weeks of work aimed at a game whose
  shape may still move. Ship first, then draw what survives.
- **More tuning** optimizes numbers against a model rather than against people.
- **Second Overseers** adds a system before anyone has said the current ones are good.

Nothing technical blocks the post. The build is live, CI is green, the tree is clean.

---

## 4. Matthew versus an agent

**Only Matthew can do these**, and each is the gate on the step above:

- Write and post the Reddit thread, in his own voice, and sit with the replies.
- Play a full run and say what feels wrong. No agent has ever played this game.
- Judge the tone — whether the writing is funny and whether Malice earns her airtime.
- Decide the art direction, including whether the vampirism reskin is on or off.
- Every irreversible or outward-facing call: a license change, a domain, a Steam page.

**An agent could do these unattended**, in rough order of worth:

- Fix the four stale statements in §5 below. Mechanical, and each one currently misleads
  the next reader.
- Delete the merged `origin/docs-presentation` and local `backup/pre-email-rewrite`.
- Reconcile the Node version across `.nvmrc` (22), `netlify.toml` (22) and CI (24).
- Bump the six patch and minor dependencies; leave the four majors for a session with a
  human watching.
- Take a tuning brief — "first prestige should land nearer 30 minutes" — and iterate it
  against the harness. It cannot decide the target; it can hit one.

---

## 5. What is rotting

Very little, and none of it urgent. The tree is clean, `main` is level with `origin/main`,
no stranded work exists anywhere.

**Stale documentation** — four claims that are now false:

1. Design spec §8 says M5 has not been started. The public build is live.
2. Design spec §10.3 lists onboarding as not started. It shipped on 2026-08-13 and
   2026-08-14, complete with the library-not-conditionals structure that question asked
   for.
3. Nine of the ten plans carry 550 unchecked steps for work that shipped. Only the
   title-screen plan was ever ticked. Harmless — `docs/README.md` calls plans a record,
   not a tracker — but it reads as unfinished work to anyone who does not know that.
4. `docs/superpowers/plans/2026-08-14-card-and-cadence.md` still says `pnpm` is not on
   PATH and that there is no root `tsconfig.json`. Both were true for the agent that ran
   it and neither is true here.

**Worth knowing, not yet a problem:**

- The harness's own warning line for the growth exponent is 18.18. The 4h→8h window
  reads 18.377 — just over, and the 2h→4h window is comfortably under at 16.970. Not a
  runaway; a number to watch after the next balance change.
- Nineteen of 28 achievements are earned in a seven-day simulation. The remaining nine
  may be correctly long-tailed or may be unreachable. Nobody has checked which.
- Four major versions have appeared since the last commit: eslint 9→10, TypeScript
  5.9→7, Vite 7→8, Vitest 3→4, plus `@types/node` 22→26 and `@vitejs/plugin-react` 5→6.
  Six days of drift, but four majors is a session's work rather than a bump.
- CI runs on Node 24 while `.nvmrc` and Netlify both pin 22. Nothing has broken, but the
  tested runtime is not the shipped one.

**Not rotting, despite appearances:** the missing art is a decision, not neglect, and the
unfinished economy is stated as unfinished in three places.
