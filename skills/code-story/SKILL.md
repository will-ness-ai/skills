---
name: code-story
description: Build a wizard-style HTML page that teaches how and why a change works, one chapter at a time.
disable-model-invocation: true
---

`/code-story <request>` — a PR, a diff, a branch, one commit — plus whatever the human says they do not understand.

A **code story** cuts a change into **chapters** and walks the reader through one at a time. A chapter answers one question, and its title *is* that question. It pulls hunks from whichever files hold that mechanism, so one chapter often spans several.

## Build it

1. **Read [`references/example.html`](references/example.html)** — a finished six-chapter story about a real 25-file PR. It is the specification: chapter size, how much diff one chapter shows, the voice of the notes, which changes earn a diagram, and how the files that earn no chapter get named and dismissed in a line each.
2. Read the change, and what explains it.
3. Copy [`references/template.html`](references/template.html) to the output path and write the chapters into `<main>`. The rail, chapter numbering, progress, note numbering, and the note↔code link all compute themselves — write `<article>` blocks and nothing else.
4. Publish with the Artifact tool. Without it, write to the scratchpad and `open` the file.
