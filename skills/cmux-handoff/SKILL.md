---
name: cmux-handoff
description: Hand this conversation to a fresh claude in a new cmux tab, with the prompt typed and waiting for the user to submit.
argument-hint: "What will the next session be used for? Add any claude flags."
disable-model-invocation: true
---

Run `/handoff` to write the handoff document, passing on whatever the user said
the next session covers.

Then open the session, keeping the prompt to one line:

```bash
<this skill's directory>/handoff.sh "Read <handoff document path> and continue" [claude flag ...]
```

Forward the claude flags the user named — `--model`, `--permission-mode`, and
the rest. `handoff.sh --help` covers its own flags.

The script types the prompt and stops there. Tell the user which tab holds the
session, and that they read the prompt and press Enter.
