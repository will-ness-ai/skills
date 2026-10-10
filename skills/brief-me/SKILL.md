---
name: brief-me
description: Brief me on a question an agent asked that is outside my expertise, so I can answer it well.
disable-model-invocation: true
---

`/brief-me [question]` — the question an agent put to the human. Without an argument, take the most recent question asked in this session; a pasted question or a pointer ("question 2") wins over that.

A **briefing** is what a decision-maker gets from staff before a call: what is being decided, what rides on it, the one idea it turns on, the options, the facts that settle it, and a lean. The human is competent but outside this domain. The goal is that they answer the question themselves, and can say why in their own words. A briefing that only makes the agent's pick sound convincing has failed, so write it to make the agent's pick checkable.

The agent that asked usually wrote the briefing too, and it already has a lean. Hold it back until the options have been laid out evenly.

Write in short, plain sentences, in Simplified Technical English. Define every technical term in one plain line the first time it appears, or drop it.

## 1. Find the question and ground it

Name the question you picked in one line, so the human can redirect you. Bring back anything the question leans on that the human may not have seen: the output it refers to ("the 20 samples above"), the files it touches, the error that prompted it. Then look up every fact you can find yourself — in the repo, the config, the docs, the earlier conversation. The human answers only what you cannot find.

When several questions are pending, triage them first: which can safely take the default, which share one idea that can be taught once, and which needs the human. Brief only the last kind in full, and say so.

**Done when** the question is named, its evidence is on screen, and every fact you could look up has been looked up.

## 2. Size the stakes

Decide what kind of door this is:

- **Two-way door** — cheap to change later, and a wrong choice is visible and harmless. Give a short briefing: the call in one line, the default and why it is the default, and what would make the human revisit it. Then go to step 4.
- **One-way door** — hard to undo, or a wrong choice costs data, money, security, legal exposure, or users. Give the full briefing in step 3.

Some questions have a right answer that a newcomer does not know: a security hole posed as an option, a legal rule, an industry convention. Say so plainly, and treat it as a one-way door even when the option list makes it look like taste. A "(Recommended)" label proves nothing here.

**Done when** the briefing opens with the door type and what a wrong choice would look like.

## 3. Write the briefing

Fit it on one screen. Use these sections, in this order:

1. **The call.** One sentence: what is being decided, in the human's words, not the agent's.
2. **The idea it turns on.** Most of these questions hinge on one idea a newcomer lacks — two things happening at once, a request failing halfway, who can read a value. Teach only that idea. Teach it with one concrete scenario from the human's own system ("two people save the same invoice at the same second"), and run that scenario through each option side by side. Name the term after the scenario has landed. An analogy is welcome when you state what maps to what and where it breaks.
3. **The options.** For each option: what the human, their users, and their bill would see — its best case and its worst case. Give each option the same care. Add an option the agent left out when the list is a false choice, and say when "here is my situation instead" is the better answer.
4. **What settles it.** The two or three facts about the human's situation that tip the decision, each phrased as a question they can answer without the jargon ("Will more than one server ever write to this?"). Then the assumptions the agent was already making about their situation, so they can correct them.
5. **The lean.** Your pick, how sure you are in the first person, and the fact that would flip it ("If you ever run a second server, switch to B").
6. **Terms to keep.** Two or three terms they will meet again, one plain line each.

For a one-way door, put one prediction question before the lean and stop there: "Before my pick — with option A, what happens when the card is charged and then the network drops?" Show the lean after the human answers or says skip, and correct their prediction if it was wrong.

**Done when** every section is present, every term is defined, and each option has its worst case.

## 4. Hand the question back

Re-ask the original question, with its original options, so the human can answer where they started. When it came from a question tool, ask it again with that tool. Under it, draft an answer in the human's words that carries the facts they supplied ("Use optimistic locking. Two edits to the same invoice are rare for us, and a 'please reload' message is fine."). The reason goes back with the answer, so the agent can apply it to the next decision too.

When the project keeps a glossary (`GLOSSARY.md`, `CONTEXT.md`), offer to add the terms to keep.

**Done when** the question is pending again with a drafted answer under it, and nothing has been decided on the human's behalf.
