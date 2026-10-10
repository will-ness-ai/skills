---
name: brief-me
description: Brief me on a question an agent asked that is outside my expertise, so I can answer it well.
disable-model-invocation: true
---

`/brief-me [question]` — the question an agent put to the human. Without an argument, take the most recent question asked in this session; a pasted question or a pointer ("question 2") wins over that.

A **briefing** is what a decision-maker gets from staff before a call: what is being decided, what rides on it, the idea it turns on, the options, the facts that settle it, and a lean. The human is competent but outside this domain. The goal is that they answer the question themselves, and can say why in their own words. Write the briefing so the human can check the agent's pick, not so the pick sounds convincing.

The agent that asked usually writes the briefing too, and it already has a lean. Hold that lean back until the options have been laid out evenly. When grounding shows the agent's own earlier recommendation was wrong or unsafe, say so in the first lines, before anything else.

Write in Simplified Technical English: one idea per sentence, active voice, at most 20 words a sentence, one word for one thing. Define each technical term in one plain line the first time you use it, or drop it. Terms inside the quoted question are exempt until the scenario has landed.

## 1. Find the question and ground it

Name the question you picked in one line, so the human can redirect you. Bring back what the question leans on that the human may not have seen: the output it refers to ("the 20 samples above"), the files it touches, the error that prompted it. Keep this to a few lines.

Then look up every fact you can — in the repo, the config, the docs, the earlier conversation. The human answers only what you cannot find. A fact you could not check (a dashboard setting, a legal or tax rule from general knowledge) is labelled as unchecked, with who can confirm it, and goes to "What settles it" as a question.

When several questions are pending, triage them: which can take a default, which share one idea that can be taught once, and which needs the human. Give each default question the short briefing from step 2, then the full briefing for the rest.

**Done when** the question is named, its evidence is on screen, and every fact is either looked up or labelled unchecked.

## 2. Size the stakes

Decide what kind of door this is:

- **Two-way door** — cheap to change later, and a wrong choice is visible and harmless. Give a short briefing: the call in one line, the default and why it is the default, and what would make the human revisit it.
- **One-way door** — hard to undo, or a wrong choice costs data, money, security, legal exposure, or users. Give the full briefing in step 3. A door that is open today but hardens later (a first tax filing, a public API, a data migration) is one-way; say when it hardens.

Some questions have a right answer that a newcomer does not know: a security hole posed as an option, a legal rule, an industry convention. Say so plainly, and treat it as a one-way door even when the option list makes it look like taste. A "(Recommended)" label proves nothing here.

**Done when** each question carries its door type and what a wrong choice would look like.

## 3. Write the briefing

Aim for one screen. When it runs over, cut repetition first; keep every worst case. Use these sections, in this order:

1. **The call.** One sentence: what is being decided, in plain words a person outside the field would use.
2. **The idea it turns on.** Most of these questions hinge on one idea a newcomer lacks — two things happening at once, a request failing halfway, who can read a value. Teach that idea, and a second only when an option fails without it. Teach it with one concrete scenario from the human's own system ("two people save the same invoice at the same second"), run through each option side by side — a table works well, and for money questions use the real numbers. Name the term after the scenario has landed. An analogy is welcome when you state what maps to what and where it breaks.
3. **The options.** For each option: what the human, their users, and their bill would see — its best case and its worst case — given the same care for each. When the list is a false choice, add the missing option, mark it as yours, and give it the same worst case. Say when "here is my situation instead" is the better answer.
4. **What settles it.** The two or three facts about the human's situation that tip the decision, each phrased as a question they can answer without the jargon ("Will more than one server ever write to this?"). Then the assumptions the agent was already making, so the human can correct them.
5. **Found nearby.** Problems grounding turned up that the question did not ask about — a decision the agent never raised, a hole next to the one in question. One line each. Leave the section out when there are none.
6. **The lean.** Your pick, how sure you are in the first person, and the fact that would flip it ("If you ever run a second server, switch to B"). When the pick is an option you added, say so.
7. **Terms to keep.** Two or three terms they will meet again, one plain line each.

For a one-way door, end the first message after "Found nearby" with one prediction question about the scenario: "Before my pick — with option A, what happens when the card is charged and then the network drops?" Pick a case the table did not already answer. When the human replies, confirm what they got right and teach what they missed; on "skip", give the answer. Then show the lean and the terms.

**Done when** every section is present, every term is defined, and each option has its worst case.

## 4. Hand the question back

Re-ask the original question, so the human can answer where they started. When it came from a question tool, ask it again with that tool. Keep the original wording, drop any recommendation label the briefing showed was wrong, add the missing option when the tool allows, and say what you changed.

Under it, draft an answer in the human's voice that carries their reason ("Use optimistic locking. Two edits to the same invoice are rare for us, and a 'please reload' message is fine."). Where a deciding fact is still theirs to give, leave a blank for it: "Tutors [are / are not] signed in when they submit the form." The reason goes back with the answer, so the agent can apply it to the next decision too.

When the project keeps a glossary (`GLOSSARY.md`, `CONTEXT.md`), offer to add the terms to keep.

**Done when** the question is pending again with a drafted answer under it, and every deciding fact in that draft is either the human's own or a blank for them to fill.
