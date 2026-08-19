---
name: test-a-skill
description: Field-test a skill by running it cold in parallel agent sessions, then turn what they hit into edits.
disable-model-invocation: true
---

A skill is a process, so reading it proves nothing. Run it.

`/test-a-skill <skill>` puts the skill in front of agents that have never seen it, on inputs picked to break it. What they produce shows whether it works. **What they had to guess shows what to fix** — that is the deliverable.

## 1. Pick subjects that break it differently

Three real inputs, each attacking a different weakness: the shape the skill was not written for, one far larger or smaller than its worked example, one whose source material is thin or contradictory. Three similar inputs test one thing three times.

**Done when** each subject names the weakness it attacks, and no two name the same one.

## 2. Run it cold

One workflow, one agent per subject, in parallel, on your strongest model.

Each prompt carries **two things**: the path to the skill file, and the request a human would type. The agent has never seen the skill and learns nothing else about the task from you. That is what makes the result mean anything.

Every urge to explain the task is a gap you just found. Put that sentence in the skill and let the next run prove it landed — a well-briefed agent only tests your briefing.

Add just what the sandbox needs: work on a copy, leave the skill folder untouched, hand back the artifact or its path.

Ask each agent to return, alongside its output:

- where the skill was silent on a decision it had to make
- what it guessed
- the hardest part
- what in the reference files was wrong, missing, or awkward to use

Say the gaps matter more than the deliverable, and that you want them blunt.

**Done when** every agent has returned a gap report, or is named as having failed.

## 3. Weigh by convergence, then verify

A gap three agents hit independently is real, and goes to the top. One agent's gap may be one agent's taste.

Then check each claim against the source before you believe it. Agents report confidently and some are wrong: the run this skill came from produced one rendering bug that a five-line test disproved, sitting beside two real bugs the same report caught.

**Done when** every reported gap is confirmed against the source or dismissed with a reason.

## 4. Offer the edits

Call `/writing-for-agents`. Then hand the human one ranked list — the fix, the evidence, and how many agents hit it — and wait for their picks.

**Done when** the human has chosen.
