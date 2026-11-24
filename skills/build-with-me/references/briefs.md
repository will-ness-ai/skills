# Understand cards

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
