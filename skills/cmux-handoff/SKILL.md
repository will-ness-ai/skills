---
name: cmux-handoff
description: Hand this conversation to a fresh claude in a new cmux tab, with the prompt typed and waiting for the user to submit.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

Open the next session with one call:

```bash
<this skill's directory>/handoff.sh "<prompt>" [claude flag ...]
```

The prompt is one line, and it carries the whole handoff — so point at what
already holds the detail: a PR, an issue, a spec, a path, a branch. When the
next session needs something that lives nowhere durable yet, write that to a
file first and point at it too.

Choose the claude flags yourself, from what the work needs:

- `--worktree <name>` — the work touches the tree and earns its own branch.
  Claude creates the worktree and inherits trust from the parent repo.
- `--model <name>` — a small mechanical task runs on a cheaper model.
- `--permission-mode plan` — the session reads and plans before it edits.

`handoff.sh --help` covers the script's own flags.

The script types the prompt and stops there. Tell the user which tab holds the
session, and that they read the prompt and press Enter.
