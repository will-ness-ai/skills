---
name: chain-of-loops
description: Run a task as a chain of tight loops — research, alignment, proof, implement, deterministic checks, agentic review, PR — each with one job and one exit.
disable-model-invocation: true
---

Work the task as a **chain of loops**. A **loop** is two segments and a repeat: _do_, _check_, go again. Keep every loop **tight** — as few segments as possible — so its feedback is fast, its context is small, and it chases one goal. Each loop has **one job and one exit**: when its exit holds, hand off to the next loop and leave the finished loop's context behind.

Every loop below names its job, its **check** (what tells you whether this pass worked), the context it loads, and its exit. Load only that loop's context. The check is where the quality comes from, so make it the strongest signal you can get: a tool, a test, a screenshot, a human, a fresh reviewer.

## Scale the chain to the task

Run every loop, every time; a small task just passes through some loops in one pass. A one-line fix still researches (where does it live?), aligns (one playback line), proves (the failing test goes green), and reviews. Choose the number of passes per loop yourself from the task; the shape of the chain stays fixed.

## Route back to the owner

When a later loop exposes a mistake from an earlier one, go back to the loop that **owns** it and run the chain forward from there. A wrong assumption belongs to research or alignment; an approach that does not work belongs to proof; a design flaw found in review belongs to implement. Fixing it in the loop you happen to be in leaves the owner's output wrong and every loop after it built on that.

## 1. Research

**Do**: investigate the codebase, prior art, and best practice for this problem. List what you know, the **gaps** that remain, and your confidence in each.
**Check**: can any gap be closed by reading more? Close those and go again. Save the gaps only the human can answer.
**Context**: product overview, where things live, past architecture decisions, the goal.

**Done when** every remaining gap is a question only the human can answer.

## 2. Alignment

**Do**: ask the human the open questions, one at a time. Then play back your understanding as a **playback**: a short spec, concrete scenarios, or a mockup for UI work.
**Check**: the human's response to the playback. Each correction is a failed test: fold it in and play back again.
**Context**: the research findings and the open questions. Leave code out of this loop.

**Done when** the human confirms the playback as what they want.

## 3. Proof

**Do**: build the smallest slice that exercises the idea end to end, and run it for real.
**Check**: real evidence the idea works. For UI, screenshots you critique against the playback; for backend, high-level tests through the public surface; for hard-to-test systems, a purpose-built harness or environment. **Correct beats clean**: this loop proves the approach, and implement makes it production code.
**Context**: how to run, test, and validate the work.

**Done when** the slice works end to end and the human has seen the evidence. Keep the proof's tests: implement reuses them.

## 4. Implement

**Do**: turn the proof into production code one slice at a time, following the codebase's conventions.
**Check**: tests. Start from the proof's tests and add one for each new behaviour.
**Context**: the codebase's shape and its code conventions.

**Done when** the feature is in the codebase and every test passes.

## 5. Deterministic

**Do**: run the repo's lint, typecheck, and formatter, and fix what they report.
**Check**: the tools' own output.
**Context**: the tool output alone; the tools carry the rules.

**Done when** every tool passes clean.

## 6. Agentic review

**Do**: dispatch reviewer subagents on the diff, each with the repo's review standards, then fix the real issues they find.
**Check**: the reviewers' findings. Fresh eyes on the diff catch what the author's context hides, and the subagents keep the main context small.
**Context**: the diff and the review standards.

**Done when** a review pass finds no real issues. A design problem routes back to implement.

## 7. PR

**Do**: open the PR, then wait for events. Route each event to the loop that owns it, run the chain forward from there, and push:

| Event | Route to |
| --- | --- |
| CI test failure | implement |
| CI lint, typecheck, or format failure | deterministic |
| Review comment | implement, then deterministic, then review |
| Merge conflict | implement |

**Check**: the PR's events: CI results, review comments, merge state.
**Context**: whatever the routed loop loads.

**Done when** the PR is merged. Merging stays the human's call.
