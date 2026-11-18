# Generated frames

A storyboard entry's `"frame"` is the frame's content. `build` writes the page on the kit, colours the code, keeps each code line's real number, lights the one thing and fits the frame. You write no HTML.

## Cuts and Reveals

An entry with a `"frame"` is a **Cut**. An entry with no frame is a **Reveal**: it holds the frame before it, with its own `"lit"` and `"show"` on top.

```json
{ "say": "Five files change.", "frame": { "type": "list", "items": ["...5 items"], "show": 1 } },
{ "say": "The second is the workflow.", "show": 2 },
{ "say": "Start with the workflow.", "show": 5, "lit": 2 }
```

- **`lit`** is the one thing the line quotes: a line number for code, a 1-based position for a list, a diagram or a terminal, or a piece of text on the frame (the first line, item or node containing it). Leave it out, or set it to `null`, for an **overview**. `build` warns when it matches nothing: the frame does not show what the line says.
- **`show`** is how many items, nodes, lines or paragraphs are visible; the rest are hidden but keep their place, so the frame stays still as they appear.

## The types

**`title`**: the poster and section cards.
`{ "type": "title", "kicker": "PR #1368 · mattpocock/skills", "headline": "Publish the skills\nto npm", "sub": "one supporting line" }`

**`code`**: an editor showing real code. `path` is the file's path in the repo; give one source:
- `"diff": "pr.diff"`: a saved unified diff (`git diff`, or the tracker's diff command). Shows that file's hunks, added and removed lines coloured, numbered by the new file.
- `"src": "src/limit.ts"`: a saved copy of the file, numbered from 1.

Optional: `"lines": "40-58"` or `"12-20,44-50"` (real numbers; a gap becomes a fold), `"tree": [".github", "~package.json", "+scripts/setup.sh"]` (a sidebar; `+` added, `~` modified), `"lang"` where the extension misleads, `"title"`.

**`terminal`**: a shell. Lines starting `$ ` are commands, `""` is a blank line, and `{ "text": "...", "tone": "ok" }` colours one (`ok`, `bad`, `warn`, `info`, `faint`). Optional `"title"`.

**`diagram`**: a row of boxes and arrows.
`{ "type": "diagram", "title": "After merging", "nodes": ["npm login", { "title": "trusted publisher", "sub": "OIDC from CI" }], "arrows": ["then"], "note": "an aside" }`. `arrows` labels the arrows in order; `false` draws none.

**`list`**: a large list: an overview, the files a change touches, a reading order.
`{ "type": "list", "title": "Read in this order", "mono": true, "items": [{ "text": "release.yml", "tag": "~", "sub": "the workflow" }] }`. `tag` is `+`, `~` or `-`; `mono` sets the items as paths.

**`page`**: a light docs page in a browser.
`{ "type": "page", "url": "https://docs.example.com/limits", "heading": "Rate limits", "body": ["A paragraph with `code`.", "## A heading"], "lit": "a phrase on the page" }`

**`table`**: rows and columns. A number `lit` lights a row; text lights the one cell holding it.
`{ "type": "table", "title": "Three keys, three clocks", "cols": ["key", "what it's for", "how long"], "rows": [["SSH check", { "text": "sign in again", "sub": "lesson 3", "tone": "warn" }, "12 hours"]] }`. A cell is text or `{ text, sub, tone }`; `mono` sets every cell as code; `show` counts rows.

**`split`**: two windows side by side, one per machine. Each of `panes` is a `terminal`, `code` or `page` spec with its own `title`.
`{ "type": "split", "panes": [{ "type": "terminal", "title": "dev-box · home", "lines": ["$ …"] }, { "type": "terminal", "title": "your laptop · café Wi-Fi", "lines": ["$ …"] }], "lit": "198.51.100.24" }`. `lit` is text (the first pane holding it) or `[pane, lit]`; the other pane is pulled back. `show` counts terminal lines and page paragraphs across both panes, left first.

**`anatomy`**: one string (a name, a command, a URL), each named part braced and labelled.
`{ "type": "anatomy", "title": "A MagicDNS name", "parts": [{ "text": "monitoring", "label": "the machine" }, ".", { "text": "yak-bebop", "label": "your tailnet" }], "note": "The short name works too: `ssh dave@monitoring`" }`. A plain string is a separator. `show` counts labels (`0` is the bare string), `lit` a named part.

**`timeline`**: events along an axis.
`{ "type": "timeline", "title": "The dev box's node key", "events": [{ "when": "day 0", "what": "you sign in", "sub": "the node key is made" }, { "gap": true }, { "when": "day 180", "what": "the key expires", "tone": "bad" }] }`. `{ "gap": true }` breaks the axis where time is skipped; `show` and `lit` count events.

**`console`**: a web app's own screen: nav tabs, a heading, rows, and a row's menu. Make it look as close as you can to the app it stands for, and where the course is about an app you own or have the source of, take its components and theme into the course's `frames.css` (the `--console-*` variables are the hooks).
`{ "type": "console", "url": "login.tailscale.com/admin/machines", "nav": ["Machines", "Users"], "heading": "Machines", "cols": ["Machine", "Address", "Last seen"], "rows": [{ "cells": ["dev-box", "100.101.102.103", "Connected"], "chips": [{ "text": "Expires in 3 days", "tone": "warn" }], "sub": "dave@example.com" }], "menu": { "row": 1, "items": ["Edit machine name…", "Disable key expiry", "-", { "text": "Remove…", "tone": "bad" }] }, "lit": "Disable key expiry" }`. `lit` is a row number, or text in a menu item, a row, or a nav tab; lighting a menu item opens the menu (`"open": true` opens it unlit). `"-"` is a menu rule; `tab` (a number or text) picks the current nav tab, the first by default; `show` counts rows.

**`sequence`**: who sends what to whom, in order.
`{ "type": "sequence", "title": "Before the first packet", "actors": ["your laptop", "coordination server", "dev box"], "messages": [{ "from": 1, "to": 2, "text": "my public key" }, { "from": 2, "to": [1, 3], "text": "each other's keys" }, { "from": "your laptop", "to": "dev box", "both": true, "text": "WireGuard, direct", "tone": "ok" }] }`. `from` and `to` are 1-based or an actor's name; `to` may be a list; `both` draws a two-way arrow. `show` and `lit` count messages.

**`guess`**: the opening question as choices (LESSON.md, "Open on a guess").
`{ "type": "guess", "kicker": "Tailscale · lesson 1 · guess first", "question": "Your dev box is at home… What has to be open on it?", "options": ["port 22, forwarded", { "text": "nothing inbound", "why": "it dials out instead" }], "answer": 2 }`. Light the answer to reveal it: the others are crossed out and every `why` shows. Lighting any other option only points at it.

**`agent`**: a Claude Code session.
`{ "type": "agent", "title": "sandbox-1 · claude", "lines": [{ "you": "Fix the dev server." }, { "tool": "Bash", "input": "tailscale serve --bg 3000" }, { "result": "Available within your tailnet: …" }, { "say": "Open that address from your laptop." }] }`. A line is `you`, `say` (a plain string is one), `tool` with `input`, `result` or `spin`. Use a real transcript, or commands and output from your sources, never an invented reply. Fitted like a terminal.

**`tree`**: a hierarchy with its branches drawn: a repo's layout, who owns what.
`{ "type": "tree", "title": "Who owns what", "items": [{ "text": "yak-bebop.ts.net", "sub": "your tailnet" }, { "text": "dave@example.com", "depth": 1 }, { "text": "dev-box", "depth": 2, "sub": "key expires" }] }`. Items are in reading order with a `depth` (0 is the root), or strings indented two spaces a level. `tone` colours an item.

**`stack`**: layers inside layers: a packet's headers, a request's middleware.
`{ "type": "stack", "title": "One packet, leaving the café", "layers": [{ "name": "your SSH session", "sub": "what you typed" }, { "name": "WireGuard", "sub": "encrypted" }, { "name": "UDP", "sub": "port 41641" }] }`. Innermost first; `show` counts from the inside out.

## Fitting

What does not fit is fitted, and `build` prints a `fit` line for each frame it changed:

- **Code** folds away the lines farthest from the lit line, so long code needs no `lines`. A long line wraps under its own number.
- **A terminal** or **an agent** drops its oldest lines; **a console** drops its last rows; **a split** fits each pane as its own type.
- **Short code, a short terminal or a short agent session** grows its type, up to 1.5 times, until the lines fill most of the window.
- **A title, a diagram, a list, a table, an anatomy, a timeline, a sequence, a guess, a tree or a stack** is sized to the frame: grown to fill it, or tightened, then shrunk to the 28px floor, then wrapped. A diagram that wrapped holds too much: split it. Content spanning under half the width warns.

A `WARN` that survives fitting names a frame that holds too much: split the moment.

Text on these frames that is not code is capped at 50 characters, and `build` warns past it.
