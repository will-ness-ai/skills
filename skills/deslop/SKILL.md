---
name: deslop
description: Clean agent slop off a branch after the work is done. Cuts narrating comments, dead code and stubs, and sizes commit and PR text to the change.
disable-model-invocation: true
---

`/deslop [target]` cleans up after an agent. The **target** is a branch, a PR, or a commit range; with none, it is the current branch against its base.

Three kinds of slop, in this order:

1. **Comments** that narrate the code, retell the session, or run longer than what they explain.
2. **Dead code**: scaffolding nothing calls, stubs, debug output, commented-out code.
3. **Commit and PR text** that is longer than the change, or claims more than it does.

Run it in a fresh session or subagent if you can: the longer the session that wrote the code, the more of its habits it brings to the cleanup.

The pass keeps behaviour as it is. It deletes comments, deletes code nothing reaches, and rewrites prose. Debug output is the one exception: deleting it changes what the program prints, so the report lists each one. Every other fix that would change what the code does or what a caller sees goes to **Left for you**, the report's list of changes the human decides on.

See [references/examples.md](references/examples.md) for before and after cases of each.

## 1. Read the change

Find the base: the PR's base branch, else the branch's upstream, else the repo's default branch, else `main` or `master`. List the commits and the files the target modifies. These are the **touched files**. Read each one in full, not only the hunks: a comment is slop or not depending on the code around it.

Skip generated files, vendored code, lockfiles, and anything the repo's ignore or lint config already excludes.

Run the project's checks and write down the result: build, type check, lint, and tests, using only what the repo itself configures. This is the **baseline** step 4 compares against.

**Done when** you know every touched file, why each commit exists, and the baseline of every check.

## 2. Cut the comments

The model copies the comments it sees: a file that keeps its verbose comments gets new ones on the next edit. So this step covers every comment in each touched file, not only the lines the target added.

**The keep test**: a comment stays only if a competent reader of this code would get something wrong without it: a constraint the code cannot show, a workaround for a bug elsewhere, a reason that is not obvious from the code. Everything else goes:

- **Narration**: says what the next line does. `// Parse the hours` above `parseInt(raw)`.
- **Session leaks**: speaks to the human or retells the chat. "As requested", "Now we", "Fixed the issue where", "Updated to", "as discussed".
- **History**: what the code used to be, what was removed, "Previously", "this was the bug", "Phase 2", review replies, reviewer names, ticket IDs. A reason worth keeping goes in the message of the commit that added the comment: carry it to step 6. When that commit is already on the base branch, the reason goes in the report instead.
- **Editorial**: argues for the design, or repeats the same point in a docstring and an inline comment.
- **Bare policy**: states what the code already shows, such as `// Only 503 is retryable` above `if (status !== 503)`. Replace it with the reason only when the code, the commits or the session state that reason; otherwise delete it.

Rewrite each comment that stays in the target's own lines:

- One line where one line will do, and never more lines than the code it explains.
- Plain words in a plain sentence, using the terms the code already uses. `// Asked, never assumed — no path may fall back to the column default.` becomes `// Callers must pass this; do not use the column default.`
- Doc comments on public APIs stay, cut to what a caller needs, in the repo's own doc style. Where the target's are the only ones, use the language's standard doc format in one line.

Outside the target's own lines, someone else wrote the comment, so delete rather than rewrite. When such a comment wraps a fact a caller needs in slop, cut it down to that fact and change nothing else: `// The bucket starts full — a cold start is not a debt.` becomes `// The bucket starts full.`

Keep exactly as they are: license headers, directives (`eslint-disable`, `nolint`, `# type: ignore`, `// @ts-expect-error`, pragmas, build tags), `TODO`s that name a person or an issue tracker entry the repo already uses, and the `TODO` on a stub step 3 reports.

**Done when** every remaining comment in the touched files passes the keep test, and every comment outside the target's lines is either untouched, deleted, or cut down to its fact.

## 3. Cut the dead code

This step covers the lines the target added. Dead code in older lines goes to Left for you.

- **Unreferenced code**: functions, classes, modules, exports, and imports the target added that nothing uses. Search the whole repo first, including tests, config, and string references such as route tables, registries or reflection. Keep an import that runs code when loaded, such as one that registers handlers. Where a use might exist, keep it and add it to Left for you.
- **Unused parameters**: delete them from private functions. On a public function, removing one changes callers, so it goes to Left for you.
- **Empty scaffolding**: traits, interfaces, base classes, and files with one implementation or none, added for flexibility nobody asked for. Delete it when nothing depends on it. A base class with one subclass, or a parameter that exposes it, counts as depended on: the inlining goes to Left for you.
- **Debug output**: `console.log`, `print`, `dbg!`, temporary logging. Logging through the project's logger, at a level the project uses elsewhere, stays.
- **Commented-out code**: delete it. Git has it.
- **Stubs**: `todo!()`, `raise NotImplementedError`, empty bodies, `// TODO: implement`, functions that return a hard-coded value where real logic belongs. A stub that something calls stays, with its `TODO`: it is unfinished work presented as finished, and it leads the report.

Code that is reached stays, even when it is clumsy. A one-use wrapper or a needless temporary is slop, but the pass deletes only code nothing reaches, so it goes to Left for you.

**Done when** each deletion was checked against the whole repo, and every stub is recorded for the report.

## 4. Prove nothing broke

Run the checks again. Every check that passed at the baseline still passes. A check that improves, such as lint no longer flagging an unused import, is fine. A check that gets worse means the pass removed something that was used: put it back.

Then read the pass's own diff. It holds deleted comments, rewritten comments, comments cut down to their fact, deleted dead code including unused imports, and deleted debug output. Revert anything else.

**Done when** every check is at or above the baseline and the diff holds only those kinds of change.

## 5. Commit the cleanup

Commit it as its own commit, on top of the work, so a reviewer can read it apart from the work. Write its message the way the base branch writes commit messages, since the target's own commits are what this pass cleans: a subject that names the cleanup, and the trailers the base branch's commits use, plus any attribution trailer the harness or the user requires.

On a branch that is already pushed, the commit reaches the PR only once it is pushed. Ask in the report, with the other questions, and push on a yes.

**Done when** the cleanup is one commit on top of the target, pushed if the human said yes.

## 6. Size the commit and PR text

The text describes the change at the size of the change. A three-line fix gets a subject line.

- **Subject**: imperative, says what changed, under about 60 characters. "Retry uploads on 503", not "Comprehensive robustness improvements to upload handling".
- **Body**: only when the reason is not obvious from the diff. A few plain sentences on why, in the words a colleague would use. Reasons carried from deleted comments go here, once you have checked them against the code: a session comment can claim a caller that does not exist.
- **PR description**: the repo's PR template if it has one. If not, what a reviewer sees before and after, and why, with links to issues.
- **Claims**: every claim matches the diff. Cut "production-ready", "all tests pass", or "implemented" where the diff does not show it. Name every stub from step 3 in the PR description, so a reviewer knows what is unfinished.

Keep the trailer block exactly as it is: `Co-Authored-By`, `Signed-off-by`, issue references, and attribution lines such as `🤖 Generated with Claude Code`.

Draft the new text. Then:

- **Unpushed commits**: show the rewording and, on a yes, apply it with a rebase. The rebase rewords the work commits under the cleanup commit, which stays on top. Without an interactive editor, run `GIT_SEQUENCE_EDITOR="sed -i 's/^pick <sha>/edit <sha>/'" git rebase -i <base>`, then `git commit --amend -F <message file>` and `git rebase --continue` at each stop. Take `<sha>` from `git rev-parse --short` so it matches the todo list.
- **A work commit the cleanup empties**: when the cleanup removes everything a work commit added, propose dropping that commit in the same rebase rather than rewording it.
- **Pushed commits**: they stay as they are. Put the better text in the PR description, and also draft the squash-merge message if the repo squash-merges.
- **The PR description**: show the new text and edit the PR on a yes. With no PR yet, the draft is ready for when it opens.

**Done when** every commit message and the PR description has a drafted replacement, or is already the right size.

## 7. Report

Give the human a short report. Every question waiting for a yes is in it. Skip a section with nothing in it.

1. **Stubs**, each with its file and line, and any text that claims they work. These come first because they are unfinished work.
2. Comments deleted and rewritten, as counts per file. A multi-line comment counts as one.
3. Dead code deleted, each with one line on why it was dead. Debug output is listed here.
4. **Left for you**: inlining, kept-but-maybe-unused code, unused public parameters, bugs noticed, dead code in older lines, and untouched files with the same comment slop.
5. The commit and PR text drafts, waiting for a yes, and the reasons carried into them from deleted comments. If the human says no, those reasons survive only here.
6. Whether the cleanup commit is pushed.
