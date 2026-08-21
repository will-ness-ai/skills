---
name: cmux-handoff
description: Hand this conversation to a fresh claude in a new cmux tab, with the prompt typed and waiting for the user to submit.
argument-hint: "What will the next session be used for? Add any claude flags."
disable-model-invocation: true
---

Write a handoff document that summarises this conversation, so a fresh agent
picks the work up. Save it in the OS temporary directory.

- Give it a "suggested skills" section naming the skills the next agent invokes.
- Point at specs, plans, ADRs, issues, commits, and diffs by path or URL, and
  leave their content where it is.
- Redact API keys, passwords, and personally identifiable information.
- Read the arguments as what the next session focuses on, and shape the document
  around them.

Then open the session, keeping the prompt to one line:

```bash
<this skill's directory>/handoff.sh "Read <handoff document path> and continue" [claude flag ...]
```

Forward the claude flags the user named — `--model`, `--permission-mode`, and
the rest. `handoff.sh --help` covers its own flags.

The script types the prompt and stops there. Tell the user which tab holds the
session, and that they read the prompt and press Enter.
