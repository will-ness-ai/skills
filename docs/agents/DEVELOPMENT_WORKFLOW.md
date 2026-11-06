# Development workflow — will-ness-ai/skills

How work moves from an idea to a merged PR in this repo, and which skill runs each step. Agents: read this before starting feature work, and name the step you are on when you start one.

## At a glance

```text
idea
 └─ /grill-with-docs ─────────── sharpen it; GLOSSARY.md + ADRs grow as you go
     ├─ /prototype ─────────────── a question only running code can answer
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

1. **Grill** — `/grill-with-docs`. Start every change here. It interviews you until the plan has no open questions, and records new terms in `GLOSSARY.md` and hard-to-reverse decisions as ADRs in `docs/adr/` (none yet).
2. **Answer what talk can't** (only when needed).
   - `/prototype` for a state model or logic you have to run to trust. Throwaway code; keep it on a `prototype/<name>` branch and point to it from the ticket.
   - `/codebase-design` when the question is the shape of a module: interface, depth, seam.
3. **Plan** (multi-session work only). `/to-spec` turns the grilled conversation into a spec on GitHub Issues; `/to-tickets` splits it into tracer-bullet tickets with blocking edges. Run steps 1–3 in one unbroken context window.
4. **Build.**
   - Multi-session: `/implement-spec` works the ticket graph in parallel worktrees on one integration branch.
   - Small: build in this session with `/tdd`, one red-green slice at a time, at seams agreed before the first test.
   - A skill is prose: write it with `/writing-for-agents` and field-test it with `/test-a-skill`, in place of `/tdd`.
   - Feedback loop: `claude plugin validate mods/<name>` often, `claude plugin test mods/<name>` per slice, `scripts/check-skills.sh` once at the end.
5. **Review** — `/code-review` against `main`: Standards against `CODING_STANDARDS.md` (none yet; `/retro` starts it), and Spec against the ticket or spec, in parallel.
6. **Ship** — `/pr` writes the body: the smallest visual of the change, before/after evidence, and a one-way or two-way door call. A PR that adds, renames, or removes a skill also updates the `README.md` skill index.
7. **Retro** — `/retro`, in the same session, before you clear. It turns this session's friction into environment changes: mechanical mistakes become checks in `scripts/check-skills.sh`, judgement calls become coding standards, missing pointers go in `AGENTS.md` (via `maintain-agents-md`).

## Repo facts the skills rely on

| What | Where |
| --- | --- |
| Agent instructions | `CLAUDE.md` (`AGENTS.md` links to it) (kept lean by `maintain-agents-md`) |
| Issue tracker | GitHub Issues — see `docs/agents/issue-tracker.md` |
| Domain glossary | `GLOSSARY.md` |
| ADRs | `docs/adr/` (none yet) |
| Coding standards | `CODING_STANDARDS.md` (none yet; `/retro` starts it) |
| Typecheck / test / lint | `claude plugin validate mods/<name>` · `scripts/check-skills.sh` · none |
| CI | `.github/workflows/check-skills.yml` |
| Default branch | `main` |

## Keeping this current

Re-run `/setup-will-ness-skills` to update the skills (it rewrites `.claude/skills/` from upstream and leaves this file alone unless you ask). Edit this file by hand when the repo's commands or conventions change; the status pane reads the skill list from `.claude/will-ness-skills.lock.json`, not from here.
