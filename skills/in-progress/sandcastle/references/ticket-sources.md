# Ticket sources

Each source resolves to the same three things a lane needs: how its tickets are **expressed in `run.json`**, the **commit trailer** that ties a commit to its ticket, and the **mark-done** action. In every case the run config is the queue — main.mts resolves `tickets` at launch and hands the batch to the agent via `{{TICKETS}}`; no orchestrator ever runs an open-ended query, so a triage label (e.g. `Sandcastle` for AFK-eligible, applied by `/to-tickets`) stays a human filter for *choosing* a batch, never something the loop reads.

## GitHub Issues

Native fit — the sandbox has `gh` and `GH_TOKEN`, so agents read and close issues themselves.

- **In run.json**: the issue numbers — `"tickets": [292, 293, 298]`. main.mts fetches each number's full body + comments at launch:
  `gh issue view <n> --json number,title,body,labels,comments`
  and inlines the results as `{{TICKETS}}`, telling the agent this list is the sole source of truth. Closed-since-launch issues resolve to closed state and land no commits — a relaunch self-heals.
- **Commit trailer**: `Closes #<n>` on its own line (auto-links and closes on merge).
- **Mark done**: the implement agent runs `gh issue close <n> --comment "..."` when it commits.

## Linear

The sandbox usually can't reach Linear, so resolve on the host.

- **In run.json**: literal entries — `"tickets": [{ "id": "TEAM-123", "title": "…", "body": "…" }]` — pre-fetched via the Linear MCP tools or GraphQL API with `LINEAR_API_KEY`. main.mts inlines them verbatim as `{{TICKETS}}`.
- **Commit trailer**: `Ticket: <TEAM-123>` on its own line.
- **Mark done**: after the PR opens, map landed commits → ticket ids via the trailer and move each to Done on the host (MCP/API). Put each ticket's Linear URL in the PR body.

## JSON list

A file of tickets (e.g. `tickets.json`) — fully offline.

- **In run.json**: the ready entries copied in as literal `{ "id", "title", "body" }` objects.
- **Commit trailer**: `Ticket: <id>` on its own line.
- **Mark done**: after the PR opens, flip the landed entries' status in the file (and commit the file if it is tracked).
