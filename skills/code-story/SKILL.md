---
name: code-story
description: Build a wizard-style HTML page that teaches how and why a change works.
disable-model-invocation: true
---

`/code-story <request>` — a **change** (a PR, a diff, a branch, one commit) — plus whatever the human says they do not understand.

A **code story** re-cuts a change into the **stack of PRs** it could have been. One big diff lands whole; a stack arrives one reviewable step at a time, each standing on the last. Each **chapter** is one step in that stack: it answers one question, its title *is* that question, and it pulls out a **slice** of the change (hunks) from whichever files help answer it.

The stack is the narrative. Each chapter answers its question and hands the reader the next one, so order the chapters the way the understanding has to build.

A code story explains **why** the code changed the way it did. Write it for a day-one contributor — someone who knows nothing yet about this domain, this codebase, or its architecture.

Tell it around code: each chapter is built from the lines it is about — changed, unchanged, or from a dependency — with a note pinning each claim to a line. Prose sets up the question and diagrams show shape; both are there to make those lines mean something.

Shape has its own devices, each for one question the lines cannot answer: a **call tree** for what runs when you call something, a **call graph** or **dependency graph** for what reaches what, a **sequence diagram** for order across participants, a **file tree** for where the change lands, and a **behaviour table** for one case as input, before, and after. Reach for one only where the code cannot show the same thing.

One chapter per mechanism, not per file and not per commit — a two-file change with three ideas in it gets three chapters. Write in short, plain sentences: the reader is new here, so shorter beats fuller. Use Simplified Technical English, and adopt the role of a technical writer.

## Build it

1. **Read [`references/example.html`](references/example.html)** — a finished six-chapter story about a real 25-file PR. It is the specification: chapter size, how much diff one chapter shows, the voice of the notes, which changes earn a diagram, and how the files that earn no chapter get named and dismissed in a line each.
2. Read the change, and what explains it: the PR body, the linked issue, the review comments, the code before it, and the unchanged or third-party code the change leans on. Where the reasoning is nowhere to be found, the story says so rather than inventing one — and says so again at the end, in its own closing section naming where each *why* came from. Say plainly where you think the change is wrong; a reader who trusts a story that was quietly covering for the code loses the story too.
3. Copy [`references/template.html`](references/template.html) into the scratchpad and write the chapters into `<main>`, deleting its leading comment. The rail, chapter numbering, progress, note numbering, and the note↔code link all compute themselves — write `<article>` blocks and nothing else.
4. Publish with the Artifact tool, then hand over the link. Without that tool, write to the scratchpad and `open` the file. `template.html` already is the design, so publish it as it stands.
