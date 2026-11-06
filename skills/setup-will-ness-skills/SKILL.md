---
name: setup-will-ness-skills
description: Set up this repo for Will's development workflow — install the workflow skills and their dependencies, write a personalized DEVELOPMENT_WORKFLOW.md, tidy AGENTS.md, and add the workflow status pane.
disable-model-invocation: true
---

Set up the repo you are in for the **development workflow**: grill → prototype → spec → tickets → build test-first → review → PR → retro. Re-running it updates the skills and leaves the rest as the user last edited it.

This skill's own folder holds `scripts/install-skills.sh` and `references/DEVELOPMENT_WORKFLOW.md`; paths below written `<skill>/…` are relative to it.

## Steps

### 1. Find the repo

Run `git rev-parse --show-toplevel`; that root is the **target**. Every path below is relative to it.
Done when the target is a git root. Outside a git repo, stop and tell the user.

### 2. Explore

Collect the **repo facts** the workflow doc and later steps need. Read what exists; leave unknowns as unknown.

- Agent file: `AGENTS.md`, `CLAUDE.md`, and whether one links to the other.
- Commands: typecheck, test (whole suite and a single file), lint — from `package.json` scripts, `Makefile`, `justfile`, `pyproject.toml`, `Cargo.toml`, or CI steps.
- Default branch: `git symbolic-ref refs/remotes/origin/HEAD`, else `main`.
- Issue tracker: `docs/agents/issue-tracker.md` if present, else the `git remote`.
- Docs: `GLOSSARY.md` (or older `CONTEXT.md`), `docs/adr/`, `CODING_STANDARDS.md`.
- Guardrails: `.github/workflows/` or other CI, pre-commit hooks, `.claude/settings.json` hooks.
- **Frontend**: a UI framework in the dependencies, or `.tsx`/`.vue`/`.svelte` files outside tests.
- PR conventions: `.github/pull_request_template.md`, `CONTRIBUTING.md`.

Done when every repo fact is filled or marked unknown.

### 3. Install the skills

```bash
bash <skill>/scripts/install-skills.sh <target>
```

It copies 16 skills into `.claude/skills/` (symlinked from `.agents/skills/` for Codex) and writes `.claude/will-ness-skills.lock.json`:

- Workflow: `grill-with-docs`, `grill-design`, `prototype`, `codebase-design`, `to-spec`, `to-tickets`, `implement-spec`, `tdd`, `code-review`, `pr`, `retro`
- Their dependencies: `grilling`, `domain-modeling`, `writing-for-agents`, `setup-matt-pocock-skills`
- Upkeep: `maintain-agents-md`

`grill-design` and `maintain-agents-md` come from `will-ness-ai/skills`; the rest from `mattpocock/skills`. With no network, point `MATT_SKILLS_SRC` / `WILL_SKILLS_SRC` at local checkouts.

Done when the script exits 0 and prints `16 skills installed`. If it lists skills also installed in `~/.claude/skills`, tell the user each appears twice until they drop one copy.

### 4. Configure the issue tracker

When `docs/agents/issue-tracker.md` is missing, read `.claude/skills/setup-matt-pocock-skills/SKILL.md` and run its process here. It asks the user up to three questions and writes `docs/agents/` plus an `## Agent skills` block in the agent file. `to-spec`, `to-tickets`, `implement-spec` and `code-review` read what it writes.
Done when `docs/agents/issue-tracker.md` and `docs/agents/domain.md` exist.

### 5. Write the workflow doc

Copy `<skill>/references/DEVELOPMENT_WORKFLOW.md` to `docs/agents/DEVELOPMENT_WORKFLOW.md` and fill it from the repo facts. Write commands, branches, and paths in backticks; write unknowns as plain words.

| Placeholder | Fill with | When unknown |
| --- | --- | --- |
| `{{REPO_NAME}}` | the repo's name | the folder name |
| `{{ISSUE_TRACKER}}` | e.g. "GitHub Issues", "local markdown in `.scratch/`" | — (step 4 settled it) |
| `{{GLOSSARY_PATH}}`, `{{ADR_PATH}}` | the paths from `docs/agents/domain.md` | `GLOSSARY.md`, `docs/adr/` |
| `{{STANDARDS_PATH}}` | the standards file | "`CODING_STANDARDS.md` (none yet; `/retro` starts it)" |
| `{{TYPECHECK_COMMAND}}`, `{{TEST_COMMAND}}`, `{{TEST_SINGLE_COMMAND}}`, `{{LINT_COMMAND}}` | the exact commands | "none" — and name the gap in step 8 |
| `{{CI_PATH}}` | the CI config path | "none" |
| `{{CHECK_LOCATION}}` | the linter config, hook, or CI file a new check belongs in | "a new CI job" |
| `{{DEFAULT_BRANCH}}` | the default branch | `main` |
| `{{AGENTS_FILE}}` | the canonical agent file | `AGENTS.md` |
| `{{PR_CONVENTIONS}}` | one sentence on the PR template or contributing rules | delete the placeholder |

Keep the lines marked `if: frontend` only when the repo has a frontend, and strip every marker and the template's header comment. When `docs/agents/DEVELOPMENT_WORKFLOW.md` already exists, show the user the diff and write only with their yes.
Done when `grep -n '{{\|if: frontend' docs/agents/DEVELOPMENT_WORKFLOW.md` prints nothing.

### 6. Tidy the agent file

Read `.claude/skills/maintain-agents-md/SKILL.md` and run it. The pointer this setup needs is: `Before feature work, read docs/agents/DEVELOPMENT_WORKFLOW.md.`
Done when `AGENTS.md` and `CLAUDE.md` resolve to the same content and it points at the workflow doc.

### 7. Add the status pane

Merge into `.claude/settings.json` (create it if missing; keep every existing key):

```json
{
  "extraKnownMarketplaces": {
    "will-ness-skills": { "source": { "source": "github", "repo": "will-ness-ai/skills" } }
  },
  "enabledPlugins": { "workflow-status@will-ness-skills": true }
}
```

This adds the `workflow-status` mod for everyone who opens the repo. The next session asks to install it from the marketplace. The pane then opens beside the chat in Claude desktop, and `/workflow-status` opens it anywhere. It shows which workflow skills this session has run, and the repo's agent readiness: agent file, workflow doc, issue tracker, glossary, installed skills, hooks, CI, and coding standards.
Done when `.claude/settings.json` parses as JSON and holds both keys.

### 8. Report

Give the user:

- Each readiness item from step 7 as ✓ or ✗, with the next step for each ✗ (for example, no CI → `/retro` or a new CI job; no glossary → the first `/grill-with-docs` starts one).
- The files this setup created or changed, uncommitted, so they can review and commit them on a branch: `.claude/skills/`, `.agents/skills/`, `.claude/will-ness-skills.lock.json`, `.claude/settings.json`, `docs/agents/`, and the agent file.
- One line on where to start: `/grill-with-docs` with the next change they want to make.
