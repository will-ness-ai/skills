# Skills

My personal agent skills — slash commands and behaviours loaded by Claude Code and other Agent-Skills harnesses.

## Language

**Skill**:
A folder under `skills/` that holds a `SKILL.md`. The harness loads it as a slash command or an automatic behaviour.

**Harness**:
The agent tool that loads a skill — Claude Code (`~/.claude/skills`) or a Codex-style Agent-Skills harness (`~/.agents/skills`).

**User-invoked skill**:
A skill that only the human starts, by name. It sets `disable-model-invocation: true`.

**Model-invoked skill**:
A skill that the agent can also reach on its own.

**External dependency**:
A skill that a `SKILL.md` calls but this repo does not contain — for example `/grilling`. Install it separately.
