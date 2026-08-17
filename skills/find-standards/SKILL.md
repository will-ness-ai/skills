---
name: find-standards
description: Find how this problem is already solved: standards we could adopt, and the industry's best practices.
disable-model-invocation: true
---

Our #1 goal when desiging software is to keep our codebase and ecosystem small and design changes by analyzing tradeoffs around code, design, domain, dependencies, and/or infrastructure. We need to consider if we should:

- Adapt existing patterns
- Adopt new patterns
- Replace existing pattern because it is outdated or bad design or just no longer works for us.

Find how the problem in front of the user is already solved, and /research two things:

- **Standards we could adopt (Internal)**: What do we already do that is applicable to this problem? What would the solution for this problem look like in our current codebase minimizing new code and dependencies?
- **Best practices (External)**: how the industry solves this, and the problem each practice solves.

Fan out subagents in one batch, one per angle, and cover sources below to generate an extremely detailed response (written after Skill tool call for writing-for-agents). Each subagent starts blank, so give it a description of the problem and what its trying to find. The subagents read; you judge what comes back, and report.

Examples of things the agents could consider: code patterns, libraries, standards, best practices, design/component choices, page structure, api structure, design patterns, resources and write-up by teams who hit this at scale. Prioritize evidence/proof and reputable sources.

Every standard names a real artifact: a library, a file path with lines, a spec, an article, a doc URL. "Use a state machine" is not a finding; `xstate` and `src/order/machine.ts:40` are. Every practice names the problem it solves, so we can tell whether we have that problem.

Report one table: each candidate, what it is, where it is already in use, and what it costs us to take. Show us both the internal and external for each candidate (leave blank if nothing was reported). Then give your recommended default, and the one fact that would change it.

Done when both sources have reported, and each candidate carries a verdict: **adopt**, **adapt**, or **ruled out** with the reason.

Before getting started, if you have access to a research skill, call the Skill tool for 'research'.
