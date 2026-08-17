---
name: find-standards
description: Find how this problem is already solved: standards we could adopt, and the industry's best practices.
disable-model-invocation: true
---

Our #1 goal when desiging software is to fit into the existing ecosystem.

Find how the problem in front of the user is already solved, and bring back two things:

- **Standards we could adopt (Internal)**: a library, a (existing or potential) shared service, an existing dependency, an existing module. Re-using what we've already done and keeping our stack small cuts duplication and complexity. What do we already do that is applicable to this problem?
- **Best practices (External)**: how the industry solves this, and the problem each practice solves.

Fan out subagents in one batch, one per angle, and cover both sources below. Each subagent starts blank, so give it a plain description of the problem, our stack, and the constraints. The subagents read; you judge what comes back, and report.

- **Internal**: code we already own. Search this codebase first. Search the rest of the GitHub org too if this project exists within an org or company.
- **External**: libraries, standards, the pattern with a name, the RFC, the write-up by the team who hit this at scale. Split the angles by question, not by search engine: what people build with, what they name it, what they regret.

Every standard names a real artifact: a library, a file path with lines, a spec, a doc URL. "Use a state machine" is not a finding; `xstate` and `src/order/machine.ts:40` are. Every practice names the problem it solves, so we can tell whether we have that problem.

Report one table: each candidate, what it is, where it is already in use, and what it costs us to take. Show us both the internal and external for each candidate (leave blank if nothing was reported). Then give your recommended default, and the one fact that would change it.

Done when both sources have reported, and each candidate carries a verdict: **adopt**, **adapt**, or **ruled out** with the reason.
