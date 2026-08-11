---
name: sandcastle
description: Run a Sandcastle lane — a sandboxed implement→review loop over a fixed batch of work in its own worktree, ended by an agent-authored PR.
disable-model-invocation: true
---

Hand a **batch** of tickets to Sandcastle's sandboxed agents and let them work **AFK**. Each run is a **lane**: its own worktree, its own branch, its own **run config** naming exactly its tickets — so concurrent lanes never interact and nothing ever queries a shared pool. The loop implements then reviews one ticket per iteration, folds each onto the lane branch, runs until **dry** (an iteration lands no commits), and ends with a PR agent that gates the branch and opens the lane's PR.

Sandcastle (`@ai-hero/sandcastle`) orchestrates coding-agent CLIs inside Docker sandboxes, driven from a repo's tracked `.sandcastle/` template. Prereqs: Docker running, plus tokens for the agent (`CLAUDE_CODE_OAUTH_TOKEN`) and GitHub (`GH_TOKEN`).

## 1. Define the lane

The batch is whatever work list you were handed — usually the ticket numbers a `/to-tickets` run just published (they are already in the conversation), but any tracker query result or literal list works. Read [`references/ticket-sources.md`](references/ticket-sources.md) for how your source expresses tickets in the run config, its commit trailer, and its mark-done action. Name the lane: branch `sandcastle/<batch-slug>`, worktree `../<repo>-<batch-slug>`.

**Done when** you can enumerate the batch exactly — ids in hand, nothing left implied by a label or query that another session could grow.

## 2. Wire the lane

- `git worktree add -b <branch> ../<repo>-<batch-slug> <base>`
- Repo has no `.sandcastle/` template yet: scaffold with `npx sandcastle init` (check `--help`; pick **sequential-reviewer**), then adapt: main.mts reads the run config and passes the batch in via `promptArgs`, ends with the PR phase and a `process.exit(0)`; mount `~/.claude/skills` read-only so in-sandbox agents can run `/implement`, `/tdd`, `/code-review`; pin the docker `imageName` (the default derives from the directory name and breaks in a worktree); persist the package-manager store across runs — and anchor every runtime dir you add (`pnpm-store/`, `patches/`, plus `run.json`) in the **root** gitignore, since re-`init` regenerates the nested one.
- In the worktree, write the untracked `.sandcastle/run.json`:

  ```json
  { "branch": "sandcastle/<batch-slug>", "base": "main",
    "tickets": [292, 293], "notes": "sandbox has no browser/emulator — verify via unit/jsdom tests" }
  ```

  `cap` is optional and defaults to tickets + 1 — pure dry-stop headroom, so a lane always ends dry, never at a cap. `notes` reaches the implement prompt verbatim.
- `.sandcastle/.env` is per-working-dir (untracked, never travels with a branch) — copy the agent token in, refresh `GH_TOKEN=$(gh auth token)`. Seed the package-manager store warm from another worktree's store dir (`cp -Rc`), then install.

**Done when** the run config echoes exactly the step-1 batch and the resolved ticket list prints their full bodies.

## 3. Launch

Show the lane in the same message that launches it — tickets, branch, base, cap, model — then start the orchestrator (`pnpm sandcastle`, or `npx tsx .sandcastle/main.mts`) in the background. Config is read once at launch: a wrong cap or list means relaunch, never an edit under a live run.

**Done when** the loop is running and iteration 1 shows in `.sandcastle/logs/`.

## 4. Run to dry

One ticket per iteration: implement → review → fold onto the lane branch. The implement prompt has the agent skip tickets blocked by open work and pick the next workable one, so one blocker never stalls the lane. Judge a run by its logs and `docker ps`, never by the process — when a run looks stalled, hung after its final iteration, or needs killing, read [`references/run-hygiene.md`](references/run-hygiene.md).

**Done when** the loop went dry and every ticket in the run config is accounted for: landed, or named with why not.

## 5. The PR

After dry, the PR phase runs as its own sandbox agent: it re-runs the repo gate — judging any red against `<base>`, so a failure that reproduces on base is filed as its own issue and named in the PR rather than blocking — authors the body from the run config's ticket list (one line per landed ticket, every unlanded one named), pushes the lane branch, and opens the PR against `<base>`. Merging stays a human act.

**Done when** the PR URL exists and its body accounts for every ticket in the run config. Report the URL, then do any host-side mark-done your source needs (ticket-sources.md).

## Lanes and each other

Lanes are independent by construction. Two residual rules: lanes over overlapping code **merge serially** — branch the second after the first merges, so cross-lane conflicts happen at merge time as ordinary git, not mid-loop where a conflict kills an orchestrator; and **one lane per worktree** — a live orchestrator owns its worktree (run-hygiene.md has the liveness check).

## Mechanics you'll rely on

- **Prompt variables**: `{{TICKETS}}` and `{{NOTES}}` arrive via the run's `promptArgs`; `{{SOURCE_BRANCH}}` = the branch the agent works on; `{{TARGET_BRANCH}}` = the host's branch when the iteration started.
- **Termination**: the in-sandbox agent ends its turn with `<promise>COMPLETE</promise>`; the orchestrator stops once an iteration lands no commits.
- **Config knobs** at the top of main.mts: the `claudeCode("<model>")` model, and the `docker({ imageName, mounts })` provider with its `onSandboxReady` install hook. Everything per-batch lives in `run.json`, not in main.mts.
