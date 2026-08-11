---
name: flashlight
description: Shine a light into a wayfinder map's fog — work one direction now, out of frontier order, or redraw the map itself.
disable-model-invocation: true
---

A **wayfinder map** charts a large effort as decision tickets on the issue tracker, wrapped in **fog**. Its **frontier** — the open, unblocked, unclaimed tickets — advances in its own order.

A flashlight is the human's beam. They point it at one direction, and this session walks in **now**, out of frontier order, to learn what lies that way.

`/flashlight <map> <request>`. Ask for the map when the invocation omits it. Shine **one beam per session**.

Where the map, its child tickets, blocking edges, claims and the frontier query physically live is tracker-specific. Consult the tracker doc's "Wayfinding operations" section for how this repo expresses each one. Default to the local-markdown tracker when no tracker doc is present.

## Two beams

Read `<request>`, and ask one question: **is the subject the map, or the territory?**

- **Territory** — the work itself. "Can we use SQLite for the queue?" → [Shine into the territory](#shine-into-the-territory).
- **Map** — the chart you already drew: what to focus on, what to defer, what no longer belongs. "We have too many open tickets — what should we focus on?" → [Redraw the map](#redraw-the-map).

Ask the human to choose when the request reads both ways.

## Shine into the territory

The beam becomes one ad-hoc ticket, and leaves the same trail as any ticket the map was charted with.

### 1. Aim the beam

Load the map — Destination, Notes, Decisions so far — and the open tickets bearing on the direction. Where an open ticket already asks this question, work that one instead: claim it, and continue from step 4.

Infer the **type** from the request:

| Type | Use it for | Resolve with |
| --- | --- | --- |
| **Grilling** (HITL) | a decision to settle by conversation — the default | `/grilling` and `/domain-modeling` |
| **Research** (AFK) | a fact from outside this working directory | a `/research` subagent |
| **Prototype** (HITL) | "how should it look, how should it behave", answered by a cheap concrete artifact | `/prototype`; `/grilling-frontend-prototyping` for an unsettled frontend look |
| **Task** (HITL or AFK) | manual work that unblocks a decision | the agent alone where it can; otherwise a precise checklist for the human |

On a **HITL** type the human answers their own questions — this session asks and records. An **AFK** type runs alone.

**Done when** the type is chosen and the map's Destination is in hand.

### 2. Zoom out

Brief the human: the **type** in bold, what this session is about to do, and where the direction sits on the map.

**Done when** the human has seen the type before any ticket exists.

### 3. Create and claim the ticket

Create a child issue of the map titled `Flashlight: <direction>`, carrying the verbatim `<request>` as its question and the `wayfinder:<type>` label. It takes no blocking edges — it is born and closed inside this session.

**Claim it** — assign it to the dev driving the map — before the work starts.

**Done when** the ticket exists, carries its type, and shows an assignee.

### 4. Work the ticket

Resolve it as a ticket of its type. Invoke the skills the map's `## Notes` names, plus the type's own. Zoom into any related or closed ticket on demand.

**Done when** the question has an answer its type can support.

### 5. Record and adjust the map

- Post the answer as a **resolution comment**, then **close** the ticket.
- Append one line to **Decisions so far**: the ticket name, its link, and a one-line gist of the answer.
- Create the tickets the answer made specifiable, and clear each graduated patch from **Not yet specified**.
- Rule out of scope whatever the answer put past the destination: close it, and leave one line in **Out of scope**.

**Done when** the ticket is closed and every section the answer touched carries its line.

## Redraw the map

The beam falls on the chart itself. This mode creates no ticket — the comments it leaves on the tickets it touches are the record.

### 1. Read the whole chart

Load the map and **every** open ticket: question, type, blockers, assignee.

**Done when** each open ticket is accounted for, the claimed ones included.

### 2. Propose

Show the human one change list, and wait for their approval. Name every edit, and why it earns its place.

**Done when** the human has approved the list.

### 3. Apply

| Verb | What it does |
| --- | --- |
| **Create** | a new ticket — then wire its edges in a second pass, because issues need ids before they can reference each other |
| **Update** | a ticket's question |
| **Re-order** | map order decides frontier order, so this is how you prioritise |
| **Re-wire** | a ticket blocked by an open ticket leaves the frontier and returns when that blocker closes, so this is how you defer |
| **Rule out of scope** | close it, and leave one line in **Out of scope**: the gist, and why it sits past the destination |
| **Cancel** | for a duplicate or a mistake. Close it, and leave one line in **Decisions so far** marked **cancelled**, carrying the reason |

Comment on every ticket you touch, saying what happened and why.

A ticket with an assignee is **claimed**: a live session is working it right now. Leave its state as it is, and comment on it, so that session learns what changed.

**Done when** every approved edit is applied, and every touched ticket carries its comment.
