# Skills

My personal agent skills for Claude Code and other Agent-Skills harnesses.

## Skills

- **[cmux](./skills/cmux/SKILL.md)** — Drive the local cmux app: workspaces, panes, surfaces, terminal input, agent sessions, and browser surfaces. Needs cmux.app and its bundled `cmux` CLI on `PATH`. No external dependencies.
- **[code-story](./skills/code-story/SKILL.md)** — Build a wizard-style HTML page that teaches how and why a change works, one chapter at a time. No external dependencies.
- **[find-standards](./skills/find-standards/SKILL.md)** — Fan out subagents to find how your problem is already solved: standards you could adopt, and the industry's best practices. External dependencies: `/research`, `/writing-for-agents`.
- **[flashlight](./skills/flashlight/SKILL.md)** — Shine a light into a wayfinder map's fog: work one direction now, out of frontier order, or redraw the map itself. Needs an existing wayfinder map. External dependencies: `/grilling`, `/domain-modeling`, `/research`, `/prototype`.
- **[grill-design](./skills/grill-design/SKILL.md)** — Converge on a frontend look through rounds of prototypes and grilling verdicts. External dependencies: `/grilling`, `/prototype`. _(previously `grilling-frontend-prototyping`)_
- **[sandcastle](./skills/sandcastle/SKILL.md)** — Run a sandboxed implement→review loop over a batch of work in its own worktree, ended by an agent-authored PR. External dependencies, mounted at run time: `/implement`, `/tdd`, `/code-review`.

- **[test-a-skill](./skills/test-a-skill/SKILL.md)** — Field-test a skill by running it cold in parallel agent sessions, then turn what they hit into edits. External dependencies: `/writing-for-agents`.

An **external dependency** is a skill these call but this repo does not contain. Install it separately.

## Install

Link every skill into your local harness skill directories (`~/.claude/skills`, `~/.agents/skills`):

```bash
scripts/link-skills.sh
```

Each entry is a symlink into this repo, so a `git pull` keeps the installed skills current. Run the script again after you add, remove, or rename a skill.

## Check

```bash
scripts/check-skills.sh
```

Verifies that every skill folder holds a `SKILL.md` whose `name` matches the folder, that it carries an `agents/openai.yaml`, that both files agree on whether the skill is user-invoked or model-invoked, and that the index above lists exactly the skills on disk. CI runs it on each push and pull request.

## Share

```bash
scripts/skill-card.mjs flashlight
```

Renders one skill as a GitHub-style PNG card sized for a post on X (16:9, rendered at 2400×1350) and copies it to the clipboard, ready to paste. The star count, fork count, description and license are read live with `gh`, so the card is never stale.

Flags: `--light` for the light theme, `--out FILE` to keep the PNG, `--no-copy` to skip the clipboard, `--open` to view it. Needs Google Chrome and an authenticated `gh`.

## Origin

Originally forked from [mattpocock/skills](https://github.com/mattpocock/skills). Matt's skills are no longer kept here; install his set separately if you want them.

## License

MIT — see [LICENSE](./LICENSE).
