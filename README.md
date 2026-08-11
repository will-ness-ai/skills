# Skills

My personal agent skills for Claude Code and other Agent-Skills harnesses.

## Skills

- **[grilling-frontend-prototyping](./skills/grilling-frontend-prototyping/SKILL.md)** — Converge on a frontend look through rounds of prototypes and grilling verdicts. External dependencies: `/grilling`, `/prototype`.
- **[sandcastle](./skills/sandcastle/SKILL.md)** — Run a sandboxed implement→review loop over a batch of work in its own worktree, ended by an agent-authored PR. External dependencies, mounted at run time: `/implement`, `/tdd`, `/code-review`.

An **external dependency** is a skill these call but this repo does not contain. Install it separately.

## Install

Link every skill into your local harness skill directories (`~/.claude/skills`, `~/.agents/skills`):

```bash
scripts/link-skills.sh
```

Each entry is a symlink into this repo, so a `git pull` keeps the installed skills current. Run the script again after you add, remove, or rename a skill.

## Origin

Originally forked from [mattpocock/skills](https://github.com/mattpocock/skills). Matt's skills are no longer kept here; install his set separately if you want them.

## License

MIT — see [LICENSE](./LICENSE).
