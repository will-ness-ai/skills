---
name: build-with-me
description: Build a goal with the human through one page they follow, looping through catching them up, asking their decisions and showing proof, until the PRs ship.
disable-model-invocation: true
argument-hint: "What are we building?"
---

# Build with me

The human follows the whole goal on one **page**, and you keep it. They come to it to understand
what you're building, to make the decisions that are theirs, and to see **proof** that it works.
The work runs in **rounds**: catch them up, ask, build, prove, show, until the goal is shipped. For a
feature that usually ends in one or more PRs and a watched deploy. Adapt the phases to whatever the
goal is.

The page is drawn from a store, and you change it only through the bundled `bwm` command:

- **board**: five columns, *Understand, Decide, Prove, Ship, Watch*. Each holds **cards** whose
  status says whose turn it is. `answer` and `check` are the human's turn, `working` and `failed`
  are yours, and `waiting`, `expected` and `done` belong to nobody.
- **design**: the goal, why it matters, the done-when lines, the **ask** (what you need from the
  human right now), today vs after, a picture of the after state, and every **decision** as one
  plain sentence.
- **queue**: the human's turn, one card at a time. Questions carry options, your recommendation and
  three ticks: *teach me more*, *decide by prototype*, *decide by bake-off*.
- **proof map**: every proof sorted into golden path, edge cases, errors and hardening, so gaps
  show.

Run the tool as `node <this skill's folder>/tool/bwm.mjs` (Node 22.13 or later), written `bwm` below.
Its bare run shows the live state and what to do next, and `bwm <command> --help` covers each
command. State lives in `.build-with-me/` in the working directory, so add that folder to
`.gitignore`.

## Steps

1. **Open the page.** Run `bwm start` with a title of a few words, the goal as one sentence in the
   human's terms, why it matters, and two to four done-when lines. Add today vs after with
   `bwm goal --today … --after …`. Then show it to the human:
   - Where the human can open localhost (Claude Code on their machine), run `bwm serve` in the
     background and give them the URL. Their Submit button reaches you through `bwm wait`.
   - Elsewhere, run `bwm render` and publish the file as an artifact. Their Submit copies a reply
     to paste into chat: an `answers[N]{…}:` header and one row per answer. Pass everything from
     that header on to `bwm import`: write it to a file with your file tool and pass
     `--reply-file <path>`, so no shell quoting touches it. Re-render after each round.

   Then run `bwm hooks install` once per project. From the next session on, your native task list
   shows on the board, and the classifier starts its shadow log (see [Hooks](#hooks)).

   Done when the human has a link and the page shows the goal, why, and done-when.

2. **Catch them up.** Find the facts yourself: read the code, run commands, check docs. For each
   thing the human must know before a decision makes sense, add an Understand card
   (`bwm card add --phase understand --status done --text-file brief.md`). Write briefs in
   **show-me** style: bullets, a code shape, a file tree or a small diagram, with a bullet
   wherever a paragraph was tempting. Done when every question you're about to ask has the facts it depends
   on, either on a card or in its `--know` lines.

3. **Ask.** One decision per `bwm ask`:
   - a plain question as the title
   - `--know` bullets with what to know first
   - `--option "<label>|<what happens if picked>"` for each choice
   - `--rec` with your recommendation, `--why`, and `--flips` (what would change your mind)

   Ask only what is the human's to decide: taste, priorities, risk, anything that changes the
   goal. Decide the rest yourself and record it with `bwm decision add`. Set the ask line
   (`bwm goal --ask`) to what you need and what it unblocks, then run `bwm wait` in the background
   and keep building whatever doesn't depend on the answer. When answers arrive:
   - **a pick**: settle it with `bwm decide <card> --text "<one plain sentence>" --why …`
   - **teach me more**: add the missing Understand card, then ask again
   - **decide by prototype**: build the smallest thing they can try, show it as a proof with
     `--check`, then ask again with what it taught
   - **decide by bake-off**: build two to four options, run the same checks on each, show the
     results as proofs, then ask again

   Done when every answer is settled, re-asked, or turned into a prototype or bake-off.

4. **Build and prove.** Every done-when line is proven by real runs, captured while they happen.
   For each claim, `bwm proof add --kind golden|edge|error|hardening` with the claim in words the
   human can check. Give each step what you did, what should happen and what did happen, with
   evidence (`--evidence <screenshot, video or output file>`, or `--term`). Give every proof a
   **control**: a run that should fail (or should work) next to the real one, so the human can see
   the test tells pass from fail. Add `bwm proof try` when the human can reproduce it in one line.
   Close it with `bwm proof pass`, or `pass --check` when their own eyes should judge it: a look, a
   feel, their device. Add the proofs you haven't run yet with `--planned`, so the map shows the
   gaps. [references/proof.md](references/proof.md) says what each kind covers and how to capture
   evidence. Done when every done-when line has golden-path proof, `bwm proofs` shows no gap you
   can't explain, and each failure has a card.

5. **Ship and watch.** Each PR is a Ship card (`waiting` while in review, `failed` while CI is red,
   `done` when merged). Each thing to watch after deploy is a Watch card, closed with what you saw.
   Mark done-when lines as they hold (`bwm goal --done-state <id>=done`). Done when every done-when
   line is done, or the human has said what's left is out of scope.

## Every round

The page is the truth of the work. Before each message to the human:

- **The board is current.** Each card's status says what is actually happening now. A new piece of
  work gets a card when it starts, and a finished one goes to `done` when it finishes.
- **The ask is current.** It names what you need from the human, or where things stand when you
  need nothing.
- **The design is current.** Settled decisions are plain sentences. When a picture helps, `--picture`
  takes an SVG of the after state. Draw it with the page's colours (`var(--fg)`, `var(--muted)`,
  `var(--panel)`, `var(--line2)`, `var(--claude)`, `var(--ok)`, `var(--bad)`) so it reads in dark
  mode. Pin each decision with `bwm decision set <id> --pin x,y`.
- **The page passed its screenshot loop.** Run `bwm check`, read every screenshot, fix what reads
  badly (copy, crowding, an empty column that needs a planned card), and run it again until it
  looks like a product you'd ship.
- **The chat stays short.** It points at the page and says what needs the human, in a line or two.
  Details live on the page.

Write everything on the page in the human's words: plain titles and sentences, with no ids, codes
or file-path jargon where a word will do.

## Hooks

`bwm hooks install` adds hooks to the project's `.claude/settings.local.json`:

- **Task sync.** Each item on your native task list (TaskCreate and TaskUpdate, or TodoWrite)
  becomes one of your cards in Prove, and follows its status: pending is `expected`, in progress is
  `working`, completed is `done`. Track your own work there as usual, and move a card to another
  phase with `bwm card set <id> --phase …` when it belongs elsewhere.
- **Classifier.** After each human message, each batch of tool calls and each reply, a small model
  names the page updates now due. In **shadow mode** (the default) it only writes them to the
  shadow log, and you keep the page yourself as the steps above say. Review that log with the human
  in `bwm shadow`, and label each moment `right`, `wrong` or `missed` (with `--should` naming what
  was due). Switch with `bwm hooks install --mode live` once they agree the labels are good enough.
- **Live mode.** A hook message starting `build-with-me page:` names each update that is due and
  the `bwm` command for it. Make those page calls after the step you are in, and leave the page
  alone between messages.

