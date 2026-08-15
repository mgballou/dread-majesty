# Docs

Three documents govern this repo, and nothing else does.

| | What it governs |
|---|---|
| [**The design spec**](superpowers/specs/2026-08-03-dread-majesty-design.md) | What the game is, and why each decision went the way it did |
| [**`ui-sensibility.md`**](ui-sensibility.md) | What the interface has to produce |
| [**`../CLAUDE.md`**](../CLAUDE.md) | How to write the code |

Everything under [`superpowers/`](superpowers/) is the record of how those three were arrived at:
one spec per change, one plan per spec. Read the design spec first — the rest amends it.

There is no `reference/` directory. The planning documents that predated the code specified a
server-authoritative Laravel engine that this project reversed, so they were deleted rather than
left to be half-believed. Everything of theirs that survived was folded into the design spec,
which says so where it happened.

---

## Specs

Each one extends the ones before it. Read them in order and the game's shape is the sum.

| Spec | Subject |
|---|---|
| [2026-08-03 · Dread Majesty](superpowers/specs/2026-08-03-dread-majesty-design.md) | The design. The cascade, the layering, the five engine rules, the milestones. |
| [2026-08-04 · Economy retune](superpowers/specs/2026-08-04-economy-retune-design.md) | Cost tracks purchases rather than holdings. |
| [2026-08-04 · Smite as a system](superpowers/specs/2026-08-04-smite-as-a-system-design.md) | Smite gains a cost (Apathy), a ceiling, and four upgrade ladders. |
| [2026-08-04 · Stage and rail polish](superpowers/specs/2026-08-04-stage-and-rail-polish-design.md) | Eleven interface fixes from a play test. |
| [2026-08-06 · Post-smite tuning](superpowers/specs/2026-08-06-post-smite-tuning-design.md) | Teeth for the shop, a correct recommendation on the rail. |
| [2026-08-08 · The soul curve](superpowers/specs/2026-08-08-soul-curve-design.md) | Prestige souls: a tunable exponent in place of a square root. |
| [2026-08-13 · Onboarding](superpowers/specs/2026-08-13-onboarding-design.md) | The beat model. One prompt at a time, gating one control. |
| [2026-08-14 · Onboarding presence](superpowers/specs/2026-08-14-onboarding-presence-design.md) | The spotlight, and enough visual weight to act on. |
| [2026-08-14 · The Malice track](superpowers/specs/2026-08-14-malice-track-design.md) | The second voice: what she wants, and both ways it can end. |
| [2026-08-14 · The title screen](superpowers/specs/2026-08-14-title-screen-design.md) | A front door for a genuinely fresh run, and a whole-number rate. |

Every spec carries a **Status** line, and every one of them reads `built` — the design spec
through M4, the rest entire. Each also names at its head what it extends or supersedes, so a
section that has been overtaken can be traced to whatever replaced it. Where a spec and the code
disagree, that is a bug in one of them — say which.

## Plans

One per spec, written to be handed to somebody with no context. They are kept because they
record what the work actually cost, not because they are worth reading first.

[economy retune](superpowers/plans/2026-08-04-economy-retune.md) ·
[stage and rail polish](superpowers/plans/2026-08-04-stage-and-rail-polish.md) ·
[smite as a system](superpowers/plans/2026-08-05-smite-as-a-system.md) ·
[post-smite tuning](superpowers/plans/2026-08-06-post-smite-tuning.md) ·
[soul curve](superpowers/plans/2026-08-09-soul-curve.md) ·
[onboarding](superpowers/plans/2026-08-13-onboarding.md) ·
[onboarding presence](superpowers/plans/2026-08-14-onboarding-presence.md) ·
[malice track](superpowers/plans/2026-08-14-malice-track.md) ·
[title screen](superpowers/plans/2026-08-14-title-screen.md) ·
[card and cadence](superpowers/plans/2026-08-14-card-and-cadence.md)

## The interface document

[`ui-sensibility.md`](ui-sensibility.md) is normative for everything in `apps/web`, and about
thirty source files cite it by section number — `tokens.css` §4, `controls.css` §3,
`TierNode.css` §8, `tokens.test.ts` §13, and so on.

**Section numbers are stable.** A section may be rewritten, but renumbering one silently breaks
every citation pointing at it. Add at the end, or add a decimal under an existing number.

## Assets

[`assets/`](assets/) holds what the README shows: screenshots, and standalone copies of the
game's own marks. The marks are pinned to the components that draw them — edit a silhouette
and `apps/web/src/ui/art/TierArt.test.tsx` fails until the copy is brought along.
