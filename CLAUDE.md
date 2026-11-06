Before feature work, read `docs/agents/DEVELOPMENT_WORKFLOW.md`.

Each skill is a folder directly under `skills/`, holding a `SKILL.md`. A skill can also carry an `agents/openai.yaml` (Codex metadata), a `references/` folder for material the `SKILL.md` points to, and a `scripts/` folder for scripts it runs.

Claude Code mods (plugins of function hooks) live under `mods/`, each listed in `.claude-plugin/marketplace.json`. Check one with `claude plugin validate mods/<name>` and `claude plugin test mods/<name>`.

Some skills call skills that this repo does not contain — for example `/grilling` or `/prototype`. The `README.md` skill index names each skill's external dependencies. Install those separately.

Every `SKILL.md` is user-invoked or model-invoked. A user-invoked skill sets `disable-model-invocation: true` in its front matter and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`; only the human starts it. A model-invoked skill sets neither, so the agent can also reach it.

To link every skill into the local harness skill directories (`~/.claude/skills`, `~/.agents/skills`), run `scripts/link-skills.sh`. Each entry is a symlink into this repo, so a `git pull` keeps the installed skills current. Run the script again after you add, remove, or rename a skill.

When you add, rename, or remove a skill, update the `README.md` skill index to match, then run `scripts/check-skills.sh` until it passes. It enforces every rule above, and CI runs it on each push and pull request.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
