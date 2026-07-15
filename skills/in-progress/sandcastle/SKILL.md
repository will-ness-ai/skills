---
name: sandcastle
description: Loop a batch of tickets through Sandcastle's sandboxed agents AFK and open a PR with the finished work.
disable-model-invocation: true
---

Hand a **backlog** of tickets to Sandcastle's sandboxed agents and let them work **AFK** — one ticket per iteration, implement then review, each folded onto one feature branch — then open a **PR**. The loop runs until the backlog is **dry** (an iteration lands no commits) or the iteration cap is hit.

Sandcastle (`@ai-hero/sandcastle`) orchestrates coding-agent CLIs inside isolated sandboxes, driven from a `.sandcastle/` directory in the repo. This skill wires that directory to your backlog, runs the loop, and ships the result as a PR. Prereqs: Docker running, plus tokens for the agent (`CLAUDE_CODE_OAUTH_TOKEN`) and GitHub (`GH_TOKEN`).

## 1. Resolve the backlog

Find where the tickets live — GitHub, Linear, or a JSON list — and turn it into one fetch that returns exactly the set to work. Read [`references/ticket-sources.md`](references/ticket-sources.md) for your source's fetch recipe, the filter that scopes the AFK pool (so specs and human-in-the-loop tickets stay out), the commit trailer that ties each commit to its ticket, and how a ticket gets marked done.

Done when: one command (or file) prints the exact ticket set, it returns at least one ticket, and you have that source's commit-trailer and mark-done convention.

## 2. Wire the harness

The loop runs from `.sandcastle/`.

- **Exists already** (a repo already set up for Sandcastle): adapt it — point the implement prompt at the step-1 backlog, set the verify commands to this repo's, confirm `.env` carries the tokens.
- **Missing**: scaffold it with `npx sandcastle init` (check `--help`; pick the **sequential-reviewer** template — implement-then-review), then adapt as above.

Into the implement prompt put: the backlog fetch from step 1, this repo's build/verify commands (the ones that gate a commit), and the commit + mark-done convention. Keep the review phase.

Adaptations worth making (hard-won in homebase): mount `~/.claude/skills` read-only so the in-sandbox agent can run `/implement`, `/tdd`, and `/code-review`; pin the docker `imageName` (the default derives from the directory name and breaks in a worktree); persist the package-manager store across runs when installs are slow.

Done when: `.sandcastle/` has an orchestrator, Dockerfile, implement + review prompts, and a populated `.env`; and the implement prompt's fetch prints the step-1 backlog.

## 3. Confirm the batch

The next step runs agents unattended and ends in a PR — confirm before launching. Show: the tickets (count + titles), the feature branch, the base branch, the iteration cap, the agent + model, and the sandbox provider.

Done when: the user has approved the batch or adjusted it.

## 4. Run the loop AFK

Capture the base branch, checkout a fresh feature branch off it (`sandcastle/<batch-slug>`), then start the orchestrator (`pnpm sandcastle`, or `npx tsx .sandcastle/main.mts`). Each iteration implements one ticket, reviews it, and folds it onto the feature branch; the loop stops on its own when an iteration lands no commits (**dry**) or hits the cap.

Done when: the orchestrator has exited, and you hold two lists — tickets that landed commits, and tickets skipped or blocked.

## 5. Open the PR

Push the feature branch (`git push -u origin <branch>`) and open the PR against the base branch (`gh pr create --base <base>`). The body carries one line per landed ticket (its link or `Closes #<n>`) plus a short summary, and it names every blocked or skipped ticket so none is silently dropped. Then mark done any tickets whose source needs a host-side update (see ticket-sources.md).

Done when: a PR URL exists, its body links every landed ticket and names the skipped ones. Report the URL.

## Mechanics you'll rely on

- **`` !`cmd` `` in a prompt file** runs `cmd` inside the sandbox at prep time and inlines its stdout — this is how the ticket list reaches the agent.
- **Prompt variables**: `{{SOURCE_BRANCH}}` = the branch the agent works on; `{{TARGET_BRANCH}}` = the host's active branch when the iteration started; `{{KEY}}` = filled from the run's `promptArgs`.
- **Termination**: the in-sandbox agent ends its turn with `<promise>COMPLETE</promise>`; the orchestrator stops the whole loop once an iteration commits nothing (backlog dry). So the implement prompt must tell the agent to skip blocked tickets and pick the next workable one — otherwise one blocked ticket at the top halts the batch.
- **Config knobs** sit at the top of the orchestrator: `MAX_ITERATIONS`, the `claudeCode("<model>")` model, and the `docker({ imageName, mounts })` provider with its `onSandboxReady` install hook.
