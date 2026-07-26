Quickstart:

```bash
npx skills add mattpocock/skills --skill=wayfinder
```

```bash
npx skills update wayfinder
```

[Source](https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder)

## What it does

`wayfinder` takes an effort too big for one agent session — wrapped in fog, where the way from here to the goal isn't visible yet — and charts it as a **shared map** of **decision tickets** on your issue tracker, then resolves them one at a time until the way is clear. It **plans, it doesn't do**: every ticket resolves a decision — a question to settle, not a slice of a build to execute — and the map is done when nothing is left to decide before someone goes and builds the thing — so it produces decisions, not deliverables.

## When to reach for it

You invoke this by typing `/wayfinder` — the agent won't reach for it on its own.

Reach for it when an effort is **more than one agent session can hold** and the route to its **destination** is still foggy — you can feel the shape of the work but can't yet write it down as a spec or a plan. For turning an *already-clear* thread into a spec, use [to-spec](https://aihero.dev/skills-to-spec); for slicing an already-understood plan into buildable tickets, use [to-tickets](https://aihero.dev/skills-to-tickets). Wayfinder sits upstream of both: it's what you run when there's too much fog to spec directly.

## Prerequisites

The map and its tickets live on the repo's issue tracker, so wayfinder needs the tracker wiring that [setup-matt-pocock-skills](https://aihero.dev/skills-setup-matt-pocock-skills) lays down — it seeds a "Wayfinding operations" section describing how the map, child tickets, blocking, and frontier queries are expressed for GitHub, GitLab, or local-markdown. Absent that doc, wayfinder defaults to a local-markdown map.

## The map is an index, fog is the frontier

The **map** is a single `wayfinder:map` issue whose tickets are its child issues — one shared URL the whole team can watch. It's an **index, not a store**: each decision lives in exactly one place (its ticket), and the map only gists and links, never restates. A session loads the map at low resolution and zooms into individual tickets on demand.

Beyond the live tickets lies the **fog of war** — decisions you can tell are coming but can't yet pin down. The test for whether something is a ticket or still fog is whether you can *state the question precisely now*, not whether you can answer it. Resolving a ticket clears the fog ahead of it, **graduating** whatever's now specifiable into fresh tickets. The **frontier** is the open, unblocked, unclaimed tickets — the edge of the known — and it's what the tracker's native blocking renders visually, so you see what's takeable without opening the map. Fog only gathers *toward* the **destination**; work past it is ruled **out of scope**, closed, never graduating.

Every ticket is **HITL** (human in the loop) or **AFK** (agent alone) — a call made per ticket, on whether the question genuinely needs you, not something its type decides. A HITL ticket only resolves through a live exchange, so the agent never answers its own questions. An AFK one it drives alone: a research ticket is still its own session, but the agent invokes `research`, the reading runs in a background agent, and the findings come back as a cited file linked from the ticket.

## It's working if

- Naming the **destination** is the first act — before any ticket exists — because it fixes the scope every ticket is measured against.
- One map is one `wayfinder:map` issue; tickets are its child issues, referred to by **name**, never a bare `#42`.
- Before working a ticket it **zooms out** for you: the ticket's type in bold, then bullets on what the work is and where it sits on the map.
- A session resolves **exactly one ticket**, records the answer as a resolution comment, closes the ticket, and appends a one-line pointer to *Decisions so far*.
- If the opening grill surfaces **no fog**, it stops and tells you the journey is small enough to skip the map.

## Where it fits

`wayfinder` is a big-idea **on-ramp**: an effort too large and foggy to spec in one sitting generates a cleared map of decisions, which then merges onto the main build flow. When the fog is pushed back and the way is clear, hand off to [to-spec](https://aihero.dev/skills-to-spec) to schedule the multi-session build (or, if the effort turned out small, implement directly). It leans on [grilling](https://aihero.dev/skills-grilling), [domain-modeling](https://aihero.dev/skills-domain-modeling), and [grill-with-docs](https://aihero.dev/skills-grill-with-docs) to resolve individual tickets, and on [prototype](https://aihero.dev/skills-prototype) and [research](https://aihero.dev/skills-research) for the ticket types that need them. When you're unsure which skill or flow fits, [ask-matt](https://aihero.dev/skills-ask-matt) routes you.
