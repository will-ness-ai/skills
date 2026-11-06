---
name: development-workflow
description: Take a task from idea to merged PR through my development workflow — research, alignment, proof, spec, tickets, implement, review, PR — run as a chain of tight loops.
disable-model-invocation: true
---

This is the development workflow: how a task moves from an idea to a merged PR. It rests on one belief: **an agentic process is a chain of loops**.

A **loop** is two segments and a repeat: _do_, _check_, go again. Keep every loop **tight**, with as few segments as possible, so its feedback is fast, its context is small, and it chases one goal. Each loop has **one job and one exit**. When its exit holds, hand off to the next loop and leave the finished loop's context behind.

Every loop below names its job, its **check** (what tells you whether this pass worked), the context it loads, and its exit. Load only that loop's context. The check is where the quality comes from, so make it the strongest signal you can get: a tool, a test, a screenshot, a human, a fresh reviewer.

## Scale the chain to the task

Run every loop, every time. A small task takes fewer passes through each loop; the shape of the chain stays fixed. A one-line fix still researches (where does it live?), aligns (one playback line), proves (the failing test goes green), specs and tickets itself (a one-ticket spec), and reviews.

## Route back to the owner

When a later loop exposes a mistake from an earlier one, go back to the loop that **owns** it and run the chain forward from there. A wrong assumption belongs to research or alignment; an approach that does not work belongs to proof; a missing requirement belongs to spec; a ticket too big to land belongs to tickets; a design flaw found in review belongs to implement. Fixing it in the loop you happen to be in leaves the owner's output wrong and every loop after it built on that.

## 1. Research

**Do**: dispatch Haiku subagents in parallel, one per question, to investigate the codebase, prior art, and best practice for this problem. Merge what they bring back into what you know, the **gaps** that remain, and your confidence in each.
**Check**: can any gap be closed by reading more? Dispatch another round on those. Save the gaps only the human can answer.
**Context**: product overview, where things live, past architecture decisions, the goal. The subagents carry the file reads, so the main context holds only their findings.

**Done when** every remaining gap is a question only the human can answer.

## 2. Alignment

**Do**: invoke the Skill tool for `grilling` to put the open questions to the human one at a time. When the open question is how something should look, invoke the Skill tool for `grill-design` instead. Then play back your understanding as a **playback**: concrete scenarios, or a mockup for UI work.
**Check**: the human's response to the playback. Each correction is a failed test: fold it in and play back again.
**Context**: the research findings and the open questions. Leave code out of this loop.

**Done when** the human confirms the playback as what they want.

## 3. Proof

**Do**: build the smallest slice that exercises the idea end to end, and run it for real. Invoke the Skill tool for `prototype` when the question is a state model or logic you have to run to trust.
**Check**: real evidence the idea works. For UI, screenshots you critique against the playback; for backend, high-level tests through the public surface; for hard-to-test systems, a purpose-built harness or environment. **Correct beats clean**: this loop proves the approach, and implement makes it production code.
**Context**: how to run, test, and validate the work.

**Done when** the slice works end to end and the human has seen the evidence. Keep the proof's tests: implement reuses them.

## 4. Spec

**Do**: invoke the Skill tool for `to-spec` to turn the confirmed playback and the proof into a spec on the issue tracker.
**Check**: every scenario from the playback and every finding from the proof appears in the spec. The human reads it and either confirms it or corrects it.
**Context**: the playback, the proof's evidence, and the research findings that shaped them.

**Done when** the human confirms the spec.

## 5. Tickets

**Do**: invoke the Skill tool for `to-tickets` to split the spec into tracer-bullet tickets with blocking edges.
**Check**: every requirement in the spec maps to a ticket, and each ticket can land on its own as one end-to-end slice.
**Context**: the spec.

**Done when** the ticket graph covers the spec with no orphan requirement and no ticket that depends on unlanded work outside its blocking edges.

## 6. Implement

**Do**: turn the proof into production code one ticket at a time, following the codebase's conventions. For a multi-ticket graph, invoke the Skill tool for `implement-spec`; for a ticket that fits this session, invoke the Skill tool for `tdd`.
**Check**: per slice, the repo's typecheck, lint, formatter, and the slice's tests, all from the tools' own output. Start from the proof's tests and add one for each new behaviour. Run the whole suite once at the end.
**Context**: the ticket, the codebase's shape, and its code conventions.

**Done when** every ticket is in the codebase and the typecheck, lint, formatter, and full test suite all pass clean.

## 7. Review

**Do**: invoke the Skill tool for `code-review` on the diff, so reviewer subagents check it against the repo's standards and the spec. Fix the real issues they find.
**Check**: the reviewers' findings. Fresh eyes on the diff catch what the author's context hides, and the subagents keep the main context small.
**Context**: the diff, the review standards, and the spec.

**Done when** a review pass finds no real issues. A design problem routes back to implement.

## 8. PR

**Do**: invoke the Skill tool for `pr` to write the body and open the PR, then wait for events. Route each event to the loop that owns it, run the chain forward from there, and push:

| Event | Route to |
| --- | --- |
| CI failure: tests, typecheck, lint, or format | implement |
| Review comment | implement, then review |
| Merge conflict | implement |

**Check**: the PR's events: CI results, review comments, merge state.
**Context**: whatever the routed loop loads.

**Done when** the PR is merged. Merging stays the human's call.
