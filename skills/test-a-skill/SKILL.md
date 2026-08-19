---
name: test-a-skill
description: Field-test a skill by running it cold in parallel agent sessions, then turn what they hit into edits.
disable-model-invocation: true
---

A skill is a process, so reading it proves nothing. Run it.

`/test-a-skill <skill>` puts the skill in front of agents that have never seen it, on work you would really bring to it. What they produce shows whether it works. **What they had to guess shows what to fix** — that is the deliverable.

## 1. Pick three realistic scenarios

Three inputs you would genuinely hand this skill, spread across the range you would genuinely use it on. Let them differ the way real work differs: in size, in subject, in how much explaining material happens to come with them. Three similar inputs test one thing three times.

Realistic beats adversarial. A pathological input tells you how the skill behaves somewhere it will never go, then tempts you to spend the skill's words fixing that instead of the path every run takes.

**Done when** each subject is work you would actually bring to this skill, and no two are alike.

## 2. Run it cold

Pin the skill first — a copy, or a fixed commit. The working tree moves under a long run: another session switches branch and the folder is gone mid-flight.

Then one agent per subject, in parallel, on your strongest model, as a **dynamic workflow**. Keep the whole fan-out in that one script: its agents are given no `Agent` or `Workflow` tool of their own, so a script that expects them to spawn anything quietly comes back empty. Where you are already inside a workflow, spawn `claude -p` headless instead.

Give each agent a schema, so the gap reports arrive structured rather than parsed out of prose. Give each one the tools it needs rather than only a directory: a permission wall reads back as a defect in the skill, in every report at once.

Each prompt carries **two things**: the path to the skill file, and the request a human would type. The agent has never seen the skill and learns nothing else about the task from you. That is what makes the result mean anything.

Every urge to explain the task is a gap you just found. Put that sentence in the skill and let the next run prove it landed — a well-briefed agent only tests your briefing.

Ask each agent to return, alongside its output:

- what it actually ran: the commands, and the files it wrote
- where the skill was silent on a decision it had to make
- what it guessed
- the hardest part
- what was wrong, missing, or awkward in the skill, in its reference files, and in the skills it calls

Say the gaps matter more than the deliverable, and that you want them blunt.

**Done when** every agent has shown what it ran, or is named as having failed. A confident report proves a read, not a run.

## 3. Verify, then rank

Check every claim against the skill, its reference files, and whatever code or tool it drives. Do this before you believe any of it.

Then rank what survives by convergence: a gap three agents hit independently is real, where one agent's may be one agent's taste. Keep that order and never the reverse — agents sharing one sandbox manufacture identical false positives, so a unanimous gap is as likely to be a property of the harness you gave them as of the skill. The run this skill came from ranked "this file is unreadable" first on a 3/3 vote. The file was fine; the tester's own permission flag was not.

**Done when** every reported gap is confirmed against the source or dismissed with a reason.

## 4. Offer the edits

Call `/writing-for-agents`. Then hand the human one ranked list — the fix, the evidence, and how many agents hit it — and wait for their picks.

**Done when** the human has chosen.
