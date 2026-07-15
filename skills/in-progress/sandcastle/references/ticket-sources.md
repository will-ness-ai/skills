# Ticket sources

Each source resolves to the same three things the loop needs: a **fetch** that lists the tickets to work, a **commit trailer** that ties a commit to its ticket, and a **mark-done** action. The fetch is scoped by a **ready filter** so only tickets meant for autonomous work enter the pool — specs, and anything needing a human in the loop, stay out.

## GitHub Issues

Native fit — the sandbox has `gh` and `GH_TOKEN`, so the agent both reads and closes issues itself.

- **Ready filter**: a label you apply to AFK-ready tickets (e.g. `afk`, `Sandcastle`), applied during triage.
- **Fetch** (embed in the implement prompt):
  `` !`gh issue list --state open --label <LABEL> --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` ``
  Tell the agent this list is the sole source of truth — no unfiltered re-query.
- **Commit trailer**: `Closes #<n>` on its own line (auto-links the issue and closes it on merge).
- **Mark done**: the agent runs `gh issue close <n> --comment "..."` when it commits.

## Linear

The sandbox usually can't reach Linear, so fetch on the host and inject the list as literal text.

- **Ready filter**: a workflow status or label meaning AFK-ready (e.g. status `Ready`, label `afk`) on the target team.
- **Fetch** (host): use the Linear MCP tools if connected, else the Linear GraphQL API with `LINEAR_API_KEY`. Write the resulting tickets (id, title, description) into the implement prompt as literal text, or into a `.sandcastle/tickets.md` the prompt `@`-includes.
- **Commit trailer**: `Ticket: <TEAM-123>` on its own line.
- **Mark done**: after the PR opens, map landed commits → ticket ids via the trailer and move each to Done on the host (MCP/API). Put each ticket's Linear URL in the PR body.

## JSON list

A file of tickets (e.g. `tickets.json`) — fully offline.

- **Ready filter**: a field on each entry (e.g. `"status": "ready"`); include only those.
- **Fetch** (host): read the file, filter to ready, inject the entries as literal text into the implement prompt (or a `@`-included `tickets.md`).
- **Commit trailer**: `Ticket: <id>` on its own line.
- **Mark done**: after the PR opens, flip the landed entries' status in the file (and commit the file if it is tracked).
