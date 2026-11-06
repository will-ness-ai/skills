---
name: maintain-agents-md
description: Keep a repo's AGENTS.md / CLAUDE.md lean and current. Use when AGENTS.md or CLAUDE.md is missing, long, or edited; after adding, moving, or renaming a doc, script, or command agents need; or when /retro or /setup-will-ness-skills asks for a pointer.
---

`AGENTS.md` is loaded into every agent's context on every turn, so each line pays **context load** forever. Keep it a **map**: short **navigation pointers** to the material agents reach on demand, plus the few facts no file in the repo confesses. Everything else lives behind a pointer.

## What belongs where

| Material | Home |
| --- | --- |
| Pointers to docs agents need (workflow, glossary, ADRs, issue tracker, standards) | `AGENTS.md`, one line each |
| Commands the environment doesn't make obvious (an unusual test runner, a required env var) | `AGENTS.md` |
| A gotcha no config confesses (generated files, a directory not to edit, an ordering constraint) | `AGENTS.md` |
| How work moves idea → PR | `docs/agents/DEVELOPMENT_WORKFLOW.md` |
| Judgement-call coding rules | `CODING_STANDARDS.md` (read by `/code-review`, not at implementation) |
| Mechanical rules (banned API, import shape, file location) | a lint rule, hook, or CI check |
| Domain terms | `GLOSSARY.md` |
| Commands already in `package.json` / `Makefile` / `justfile` | the environment; leave them there |

A **pointer** names the material and the condition for reaching it: `Before feature work, read docs/agents/DEVELOPMENT_WORKFLOW.md.` The condition does the triggering, so front-load it.

## Steps

1. **Resolve the file.** One file, two names: whichever of `AGENTS.md` / `CLAUDE.md` holds the content is canonical, and the other is a symlink to it (`ln -s AGENTS.md CLAUDE.md`). When neither exists, create `AGENTS.md` and link `CLAUDE.md` to it. Where symlinks are unavailable (Windows checkouts), make the second file the single line `@AGENTS.md`.
   Done when both names resolve to the same content.

2. **Verify every pointer.** For each path, command, skill, or script the file names, check it exists: the path is on disk, the script is in `package.json` (or the build tool's config), the skill is in `.claude/skills/` or `.agents/skills/`.
   Done when every reference is marked live or stale.

3. **Fix and add.** Repoint or delete stale references. Add a pointer for each agent-facing doc present but unnamed: `docs/agents/DEVELOPMENT_WORKFLOW.md`, `docs/agents/*.md`, `GLOSSARY.md`, `docs/adr/`, `CODING_STANDARDS.md`. Keep any `## Agent skills` block that `/setup-matt-pocock-skills` wrote; update its lines in place.
   Done when every agent-facing doc in the repo is reachable from the file in one hop.

4. **Prune.** Test each remaining line against the table above and against the default: would an agent behave differently without it? Lines that restate the environment, describe what the model already does, or belong in another home are candidates. Pair each candidate with its move: delete, or relocate to a named home.
   Done when every line is kept or paired with a move, and the file would be under 150 lines with the moves applied.

5. **Report and apply.** Steps 1–3 apply directly. Show the user the diff so far, the line count before and after, and the step 4 moves as one list; apply the moves they accept.
