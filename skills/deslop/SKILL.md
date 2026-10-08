---
name: deslop
description: Clean agent slop off a branch after the work is done. Cuts narrating comments, dead code and stubs, and sizes commit and PR text to the change.
disable-model-invocation: true
---

`/deslop [target]` cleans up after an agent. The **target** is a branch, a PR, or a commit range; with none, it is the current branch against its base.

Three kinds of slop, in this order:

1. **Comments** that narrate the code, retell the session, or run longer than what they explain.
2. **Dead code**: scaffolding nothing calls, stubs, debug output, commented-out code.
3. **Commit and PR text** that is longer than the change.

This is a pass you run after the work, not a rule the agent follows while it works. Rules against comments stop holding within a few turns; a separate pass holds. Run it in a fresh session or subagent if you can. The longer the session that wrote the code, the more of its habits it brings to the cleanup.

The pass changes no behaviour. It deletes comments, deletes code nothing reaches, and rewrites prose. If a fix would change what the code does, propose it in the report and leave it.

See [references/examples.md](references/examples.md) for before and after cases of each.

## 1. Read the change

List the commits and the files the target changes. Read each changed file in full, not only the hunks: a comment is slop or not depending on the code around it.

Leave alone generated files, vendored code, lockfiles, and anything the repo's ignore or lint config already excludes.

**Done when** you know every file the target touches and why each commit exists.

## 2. Cut the comments

The model copies the comments it sees. A file that keeps its verbose comments gets new ones on the next edit. So this step covers every comment in each touched file, not only the lines the target added. Outside the target's own lines, only delete. Do not rewrite a comment someone else wrote.

A comment stays only if a competent reader of this code would get something wrong without it: a constraint the code cannot show, a workaround for a bug elsewhere, a reason that is not obvious from the code. Everything else goes:

- **Narration**: says what the next line does. `// Parse the hours` above `parseInt(raw)`.
- **Session leaks**: speaks to the human or retells the chat. "As requested", "Now we", "Fixed the issue where", "Updated to".
- **History**: what the code used to be, what was removed, "Phase 2", review replies, ticket IDs. That belongs in the commit message. If the reason is worth keeping, move it there.
- **Editorial**: argues for the design, or repeats the same point in a docstring and an inline comment.

Rewrite each comment that stays, in the target's own lines:

- One line where one line will do. Never more lines than the code it explains.
- Plain words. No em dashes, no coined terms ("the oracle", "load-bearing"), no aphorisms. `// Asked, never assumed — no path may fall back to the column default.` becomes `// Callers must pass this; do not use the column default.`
- Doc comments on public APIs stay, cut to what a caller needs. Match how the rest of the repo writes them.

Never touch license headers, directives (`eslint-disable`, `# type: ignore`, `// @ts-expect-error`, pragmas, build tags), or `TODO`s that name a person or an issue tracker entry the repo already uses.

**Done when** every remaining comment in the touched files passes the test above, and no comment outside the target's lines was rewritten.

## 3. Cut the dead code

Only in the lines the target added. Older dead code is someone else's call.

- **Unreferenced code**: functions, classes, modules, exports, and parameters the target added that nothing uses. Search the whole repo, including tests, config, and string references such as route tables or reflection, before you delete. If any use might exist, keep it and list it in the report.
- **Empty scaffolding**: traits, interfaces, base classes, and files with one implementation or none, added for flexibility nobody asked for. Delete it when nothing depends on it. When code depends on it, propose the inlining in the report instead.
- **Debug output**: `console.log`, `print`, `dbg!`, temporary logging. Keep logging that goes through the project's logger at a level the project uses elsewhere.
- **Commented-out code**: delete it. Git has it.
- **Stubs**: `todo!()`, `raise NotImplementedError`, empty bodies, `// TODO: implement`, functions that return a hard-coded value where real logic belongs. Do not delete a stub that something calls. It is unfinished work presented as finished, and the human needs to know. List each one first in the report.

**Done when** each deletion was checked against the whole repo, and every stub is in the report.

## 4. Size the commit and PR text

The text describes the change at the size of the change. A three-line fix gets a subject line.

- **Subject**: imperative, says what changed, under about 60 characters. "Retry uploads on 503", not "Comprehensive robustness improvements to upload handling".
- **Body**: only when the reason is not obvious from the diff. A few plain sentences on why. No headings, no checkmark lists, no file-by-file tour, no test-run claims, no "robust", "comprehensive", "seamless".
- **PR description**: the repo's PR template if it has one. If not, what a reviewer sees before and after, and why. Keep links to issues. Drop the list of every file touched.

Keep trailers (`Co-Authored-By`, `Signed-off-by`, issue references) exactly as they are.

Draft the new text. Then:

- **Unpushed commits**: show the rewording and, on a yes, apply it with a rebase.
- **Pushed commits**: never rewrite. Put the better text in the PR description instead, or in the squash-merge message.
- **The PR description**: show the new text and edit the PR on a yes.

**Done when** every commit message and the PR description has a drafted replacement, or is already the right size.

## 5. Prove nothing changed

Run the project's build, type check, lint, and tests. They pass exactly as they did before the pass. If one fails, the pass removed something that was used. Put it back.

Then read the pass's own diff. It holds only deleted comments, rewritten comments, deleted dead code, and deleted debug output. Anything else is out of scope. Revert it.

**Done when** the checks match their state before the pass and the diff holds nothing else.

## 6. Report

Commit the cleanup as its own commit, so a reviewer can read it apart from the work. Then give the human a short report:

1. **Stubs** found, each with its file and line. These come first because they are unfinished work.
2. Comments deleted and rewritten, as counts per file.
3. Dead code deleted, each with one line on why it was dead.
4. Proposals left unapplied: inlining, kept-but-maybe-unused code.
5. The commit and PR text drafts, waiting for a yes.
