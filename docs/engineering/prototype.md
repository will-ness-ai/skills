## What it does

`prototype` writes **throwaway code that answers a question** — does this state model feel right, or what should this screen look like. The question comes first and decides the shape of everything that follows; a prototype that answers the wrong question is pure waste, however good it looks.

Throwaway is a constraint on how the code is *written*, not a promise to destroy it. No tests, no error handling beyond what makes it run, no abstractions, no persistence — because none of that helps you learn the one thing you're trying to learn. What survives is the answer, folded into the real code, and the prototype itself, parked on a branch out of main as the evidence the answer came from.

## When to reach for it

Type `/prototype`, or the [agent](https://www.aihero.dev/ai-coding-dictionary/agent) reaches for it automatically when a task fits.

Reach for it the moment you hit a question you can't settle by talking — a state machine whose edge cases you can't hold in your head, a screen you can't picture until you see three versions side by side. [Grilling](https://www.aihero.dev/ai-coding-dictionary/grilling) sessions balloon on exactly these questions: the agent rephrases, you guess, and the scope grows to fill the uncertainty. Stop grilling, build the throwaway version, look at it, then answer in one line. If instead something already built is misbehaving and you want to know why, use [diagnosing-bugs](https://aihero.dev/skills-diagnosing-bugs) — prototyping explores what to build, not why the built thing is broken.

You will also arrive here without choosing to. [wayfinder](https://aihero.dev/skills-wayfinder) files `prototype` decision [tickets](https://www.aihero.dev/ai-coding-dictionary/ticket) on its map, and working one is this skill.

## Two branches

The question picks the branch, and the branches produce very different artifacts:

- **"Does this logic / state model feel right?"** — a **single shareable HTML file**. One self-contained page, no build and no server, that someone opens by double-clicking. It carries a labelled state panel that re-renders after every click, free-play buttons for poking at the model in any order, and tabbed **guided walkthroughs** — one scenario per tab, each with the ordered buttons to press underneath it. Everything is labelled in domain language, so you can hand it to a designer, a PM or a domain expert and let them feel the model themselves. The logic behind the page is a small pure module — a reducer, a machine, a set of functions — kept clean of the DOM so the validated version lifts straight into the real code.
- **"What should this look like?"** — several **radically different** UI variations on one route, switchable from a floating bottom bar and a `?variant=` URL param. Variants must disagree about structure, not colour; three tweaked card grids is wallpaper, not a prototype. They render inside a real page wherever possible, against real data and real density, because a variant judged in a vacuum always looks fine.

Both keep state in memory, start with no thinking required, and show you the full state after every step. The moment you find yourself hardening one — adding a test, wiring the real database, generalising for a case you might want later — you have stopped prototyping.

## The prototype is a primary source

A finished prototype leaves two things, and they go to different places.

The **answer** — the verdict plus the question it settled — is captured durably: a commit message, an ADR, the implementation issue. That is what the main branch keeps, folded into the real code.

The **prototype** is the runnable evidence the answer came from, and it is not deleted. It doesn't belong in main either — there is nothing there to maintain and it rots fast — so it is committed to a throwaway `prototype/<name>` branch out of main, never merged, with a [context pointer](https://www.aihero.dev/ai-coding-dictionary/context-pointer) to that branch left on the implementation issue. Main stays clean; the exploration stays findable and re-runnable by whoever picks the work up next.

## Common questions

**Wait — isn't the prototype supposed to be deleted?**
Not any more. It used to be: build it, keep the answer, bin the code. The sharpest objection to that was never about speed — it was *who picks up the work next [session](https://www.aihero.dev/ai-coding-dictionary/session), and what do they have to work from?* A prose summary of a prototype loses the thing that made it convincing. So the prototype is now treated as a [primary source](https://www.aihero.dev/ai-coding-dictionary/primary-source): it lands on a `prototype/<name>` branch out of main and the implementation issue points at it. What changed is where the code lives, not the discipline — it still never merges into main.

**It used to build a terminal app. Where did that go?**
The logic branch now emits a single shareable HTML file instead. A terminal app can only be driven by someone with the repo cloned and a runtime installed, which rules out exactly the people whose opinion the prototype needs — the designer, the PM, the domain expert who knows what the state model is supposed to mean. One self-contained file that opens by double-click and survives being emailed can be driven by anyone. The pure logic module underneath is unchanged, and is still the part that lifts into the real code.

**An agent told me to `/prototype` when I should have been implementing.**
Known, and it is a naming problem. `prototype` is a generic, appealing word that reads to a flow-unaware agent as "the obvious next step" once tickets exist, so it gets recommended by name even where the design was fully settled in conversation. If you already know what to build, the next step is `/implement`, per ticket. Reach for a prototype only when a specific design question is genuinely unresolved and talking won't resolve it.

**Should I prototype the whole application before building any of its production features — say, to demo it to prospects?**
That is a different artifact wearing this skill's name. A prototype here is scoped to one question, and "what is the whole app?" isn't one. A full-app prototype has no natural stopping point, so it becomes the production app by momentum: the cleanup pass never happens, and code written under prototype rules — no tests, no error handling — ends up in front of users. If you need a sales demo, build it deliberately as a demo and be explicit that none of it is production. If you need to settle a design question, cut it down to that question.

**How do I run it in its own session?**
A prototype lives in its own directory and generates a lot of [context](https://www.aihero.dev/ai-coding-dictionary/context) you don't want in the thread that asked the question, so run it somewhere else and bring back only the answer. [handoff](https://aihero.dev/skills-handoff) is the bridge in both directions.

**Isn't this the fastest possible way to burn tokens?**
It can be, if you prototype questions you could have answered by talking, or let one prototype sprawl across a whole feature. The comparison that matters isn't tokens against zero; it's [tokens](https://www.aihero.dev/ai-coding-dictionary/token) against building the wrong state model and finding out after it has production callers. Keep the question narrow and the run short, and the spend stays proportionate.

## It's working if

- You can say in one sentence what question the prototype exists to answer — and it's written at the top of the demo, not just in your head.
- Someone who doesn't read code can drive the logic demo. They open the file, press the buttons in a walkthrough tab, and describe what they see in their own words.
- Someone says "wait, that shouldn't be possible" or "huh, I assumed X". That's a bug in the *idea*, which is the entire point.
- The UI variants disagree about layout and information hierarchy, not just colour and copy — and the feedback you get is "the header from B with the sidebar from C".
- It is answered in one sitting. If you're still building it a day later, the question was too big; split it.
- When it's over, main contains the decision and none of the prototype, and the implementation issue points at the branch that still holds it.

## Where it fits

`prototype` is a **reach-for-it-anytime standalone** — you drop into it to settle one design question, then drop back out — and it is also machinery another skill runs on.

Its largest consumer is [wayfinder](https://aihero.dev/skills-wayfinder). A wayfinder map is made of **decision tickets**, and `prototype` is one of the four types a ticket can be: the one used when the blocking question is "how should this look" or "how should it behave", which no amount of discussion resolves. Wayfinder raises the fidelity of a foggy discussion by making something concrete to react to, and this skill is how that concrete thing gets built. A prototype ticket is resolved by the answer, and the prototype is linked from the map as an asset.

The other neighbours are upstream and downstream of that. [grill-me](https://aihero.dev/skills-grill-me) and [grill-with-docs](https://aihero.dev/skills-grill-with-docs) answer grillable questions; the ungrillable ones come here instead, and the one-line answer goes back into the interview. Downstream, a validated state model or UI direction becomes settled input for [to-spec](https://aihero.dev/skills-to-spec), which can inline the decision-rich snippet the prototype produced rather than describing it in prose. For anything else, [ask-matt](https://aihero.dev/skills-ask-matt) routes you over the whole set.
