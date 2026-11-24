# Understand cards and question briefs

An Understand card gets the human from "I don't know this" to "I can decide" in one look. The
diagram does the explaining; the bullets carry what a picture can't: numbers, names, caveats.

## Pick the diagram

- **Parts and links**: boxes for the pieces (services, files, people, devices), arrows for who
  calls or feeds whom. Use it for "how does this fit together?"
- **Flow**: the path one request, file or event takes, left to right, with the step that matters
  highlighted. Use it for "what happens when…?"
- **Before vs after**: two small panels side by side, with the change in colour. Use it for "what
  will be different?"
- **Gap map**: what exists in one colour, what's missing in another (dashed outline). Use it for
  audits: "what do we have, what's missing?"
- **Timeline**: what happened and when, as dots on a line. Use it for "what changed since…?"

## Draw it

- An `<svg viewBox="0 0 W H">` with no width or height; it scales to the card. Keep it to about
  600 × 300 units and 10 or fewer labelled shapes.
- Colours only through the page's variables, so it reads in light and dark: `var(--fg)` for
  labels, `var(--muted)` for secondary text, `var(--panel)` and `var(--line2)` for boxes and
  edges, `var(--claude)` for what Claude is doing, `var(--ok)` for what works or exists,
  `var(--bad)` for what's broken or missing, `var(--you)` for what needs the human.
- Labels are the human's words, 12–14 units, at most four words each. No ids or file paths unless
  the decision turns on one.
- No scripts, links or embedded HTML: the page drops them.

## Then the bullets

Two to five, each one fact the picture can't show: a count, a name, a risk, a source. A card with
no bullets is fine when the drawing says it all.

## What makes an Understand card

- It teaches one concept the human needs for a coming decision: how something works here, what a
  term means, what exists and what's missing, what changed.
- Its title is what they'll learn ("How agents pick up CLAUDE.md and AGENTS.md"), never a task you
  did ("Audit the agent files").
- It starts where the human is. When they're new to the area, the first cards cover the basics,
  and the specific findings build on them.
- A finding belongs on the card it explains ("4 tests fail today" goes on the testing card), not on
  a card about your process.

## Question briefs

The question card is where the human decides, so it carries everything the decision needs:

- **The brief** (`--brief-file`): a diagram of the options side by side (a comparison grid, before vs
  after for each, or where each one lands in the system), then two to four bullets on what's being
  decided and why it matters now.
- **Read first** (`--read-first`): the Understand cards behind the question. Add a card for any
  concept the brief leans on that the board doesn't teach yet.
- **Evidence per option** (the third `|` part of `--option`): what you saw that supports or
  undercuts it, what it costs, what it risks. "Half a day; no game code touched; 3 sessions this
  week re-learned the rules" beats "cheap and safe".
- **The recommendation**: `--why` points at that evidence; `--flips` names what would change it.

When the human says they're unsure, they've told you what the board doesn't teach yet. Add those
cards, then `bwm reask` with `--whats-new`.

