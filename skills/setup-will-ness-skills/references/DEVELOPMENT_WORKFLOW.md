<!--
  Template. /setup-will-ness-skills copies this to docs/agents/DEVELOPMENT_WORKFLOW.md
  in the target repo and fills every {{PLACEHOLDER}} from what it found there.
  A line ending in an "if: frontend" comment is kept only when the repo has a
  frontend; the marker itself is removed. No placeholder or comment survives
  the copy.
-->
# Development workflow — {{REPO_NAME}}

How work moves from an idea to a merged PR in this repo, and which skill runs each step. Agents: read this before starting feature work, and name the step you are on when you start one.

## At a glance

```text
idea
 └─ /grill-with-docs ─────────── sharpen it; GLOSSARY.md + ADRs grow as you go
     ├─ /prototype ─────────────── a question only running code can answer
     ├─ /grill-design ──────────── a look you have to see to judge        <!-- if: frontend -->
     ├─ /codebase-design ───────── where the seam goes, how deep the module is
     │
     ├─ small: build it here ───── /tdd, then /code-review
     └─ multi-session:
         /to-spec → /to-tickets → /implement-spec
                                  (/tdd per ticket, one /code-review at the end)
 └─ /pr ────────────────────────── write the PR body
 └─ /retro ─────────────────────── fix the environment, not the code
```

## The steps

1. **Grill** — `/grill-with-docs`. Start every change here. It interviews you until the plan has no open questions, and records new terms in {{GLOSSARY_PATH}} and hard-to-reverse decisions as ADRs in {{ADR_PATH}}.
2. **Answer what talk can't** (only when needed).
   - `/prototype` for a state model or logic you have to run to trust. Throwaway code; keep it on a `prototype/<name>` branch and point to it from the ticket.
   - `/grill-design` for UI: rounds of five radically different prototypes until every component has a verdict. <!-- if: frontend -->
   - `/codebase-design` when the question is the shape of a module: interface, depth, seam.
3. **Plan** (multi-session work only). `/to-spec` turns the grilled conversation into a spec on {{ISSUE_TRACKER}}; `/to-tickets` splits it into tracer-bullet tickets with blocking edges. Run steps 1–3 in one unbroken context window.
4. **Build.**
   - Multi-session: `/implement-spec` works the ticket graph in parallel worktrees on one integration branch.
   - Small: build in this session with `/tdd`, one red-green slice at a time, at seams agreed before the first test.
   - Feedback loop: `{{TYPECHECK_COMMAND}}` often, `{{TEST_SINGLE_COMMAND}}` per slice, `{{TEST_COMMAND}}` once at the end.
5. **Review** — `/code-review` against `{{DEFAULT_BRANCH}}`: Standards (against {{STANDARDS_PATH}}) and Spec (against the ticket or spec), in parallel.
6. **Ship** — `/pr` writes the body: the smallest visual of the change, before/after evidence, and a one-way or two-way door call. {{PR_CONVENTIONS}}
7. **Retro** — `/retro`, in the same session, before you clear. It turns this session's friction into environment changes: mechanical mistakes become checks in {{CHECK_LOCATION}}, judgement calls become coding standards, missing pointers go in `AGENTS.md` (via `maintain-agents-md`).

## Repo facts the skills rely on

| What | Where |
| --- | --- |
| Agent instructions | `{{AGENTS_FILE}}` (kept lean by `maintain-agents-md`) |
| Issue tracker | {{ISSUE_TRACKER}} — see `docs/agents/issue-tracker.md` |
| Domain glossary | {{GLOSSARY_PATH}} |
| ADRs | {{ADR_PATH}} |
| Coding standards | {{STANDARDS_PATH}} |
| Typecheck / test / lint | `{{TYPECHECK_COMMAND}}` · `{{TEST_COMMAND}}` · `{{LINT_COMMAND}}` |
| CI | {{CI_PATH}} |
| Default branch | `{{DEFAULT_BRANCH}}` |

## Keeping this current

Re-run `/setup-will-ness-skills` to update the skills (it rewrites `.claude/skills/` from upstream and leaves this file alone unless you ask). Edit this file by hand when the repo's commands or conventions change; the status pane reads the skill list from `.claude/will-ness-skills.lock.json`, not from here.
