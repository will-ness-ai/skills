---
name: animatic-lessons
description: Teach the user a topic as a course of short narrated videos, a few at a time, with the user picking what comes next.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

`/animatic-lessons <topic>` teaches a topic as a **course**: a run of **lessons**, each one a 60 to 90 second animatic with captions and a lesson page. You make the first few, the user picks what comes next from the **frontier**, and the loop repeats.

Every video is an **animatic**, built by the engine in [`references/engine/`](references/engine/). Read its [`STYLE.md`](references/engine/STYLE.md) and [`FRAMES.md`](references/engine/FRAMES.md) now: their words (**moment**, **Cut**, **Reveal**, **lit**) are used here as they define them. Below, `<skill>` is this skill's folder and `<engine>` is `<skill>/references/engine`.

**The voice.** With no flag, the engine speaks in the machine's built-in voice, and in Kokoro, a local model, where there is none. A voice the user names, or one the repo records in `docs/agents/animatic.md` under **Flags**, wins: [`VOICE.md`](references/engine/VOICE.md) has each engine's flag and how to test it. The **voice flags** you settle on go on every build.

## 1. Place the course

A course is one folder. Where it goes is the project's call: put it where this project keeps its docs (read `AGENTS.md` / `CLAUDE.md` and the tree; a `docs/` folder is the usual home), named for the topic. With no repo, or no way to write files, use `$TMPDIR/course-<topic>/` and hand the videos over directly.

A course folder that already exists is a course to **resume**: read its `README.md` and go to step 4 with the user's request.

Otherwise copy the starter kit in, `cp -R <skill>/references/starter/. <course>/`, and add the kit's ignore lines to the repo's `.gitignore` ([`KIT.md`](references/KIT.md), "What to commit").

Done when the course folder holds `tools/lesson.mjs` and `assets/`, and you can say why it lives where it does.

## 2. Research

Find the topic's high-trust sources (official docs, the maintainers' own writing, a standard text) and read them this session. Your memory of the topic chooses what to look up; the sources decide what a lesson says.

Write `research.md` in the course folder: each source with its URL and what it settles, then **Gaps**, the things you looked for and did not find.

Done when every idea you plan to teach has a source you read today beside it, and Gaps is written.

## 3. Make the intro lessons

Plan the one to three lessons everything else stands on, in the order the ideas depend on each other, and start making them. Ask a question first only when the request leaves the topic itself unclear.

Before the first storyboard, set up what the whole course shares, in `course.json` ([`KIT.md`](references/KIT.md)):

- The **cast**: the user's own world, named once and reused in every example (their laptop, their dev box, `sandbox-1`). Take it from the request and the project.
- The **map**: one picture of that world. Every lesson draws on it and adds to it, so the viewer learns the layout once.

Then make each lesson as step 5 describes.

Done when each intro lesson passes step 5's bar.

## 4. Offer the frontier

The **frontier** is the set of lessons the user can reach from what they have now watched. Offer the best four to seven, as prose in your reply, numbered, so the user answers with numbers. Each entry says what the lesson covers, what it unlocks, and why this user might want it:

```
Where next? Pick any, for example "2, 3 and 5".

1. **Tags and grants.** Who can reach what. Unlocks: locking a sandbox down so it can't reach your laptop. Worth it if agents run on machines you don't fully trust.
2. **Auth keys.** Machines that join without a browser sign-in. Unlocks: sandboxes that add themselves. Worth it once you create machines from a script.
```

Order them by how much each one unlocks for this user. Mark any that needs another first ("after 1").

Record the course in its `README.md`: the lessons made, each with its one line to remember, then the frontier as offered. That file is the course's whole memory; a later session resumes from it.

Hand over with the offer: each new lesson's title, run time and video path, the voice that spoke, and what step 5's loops could not check.

Done when the user has picked, or has said they are finished. On picks, make those lessons by step 5 and return here.

## 5. Make one lesson

Read [`LESSON.md`](references/LESSON.md) before you write: it holds what a lesson contains and the rules its content obeys. [`references/example/`](references/example/) is one finished lesson's source, to copy the shape from.

1. Write `lessons/NNNN-<slug>/storyboard.src.json` and `lesson.json`.
2. Build:
   ```
   ANIMATIC=<engine>/scripts/animatic.mjs node tools/lesson.mjs build lessons/NNNN-<slug> <voice flags>
   ```
   It expands the map moments, runs the engine's `build` (plan gate, frames, voice, video, sheet), burns in captions and writes every lesson page. Fix what it prints and rebuild until it ends with `no warnings`.
3. Run both loops in [`LOOPS.md`](references/LOOPS.md): the **screenshot loop**, then the **learner loop**. Each finds what the other cannot.

Done when the build ends with `no warnings`, a screenshot pass finds nothing left to fix, and every point the learner raised is fixed or answered with the source that settles it.

---

Built on Matt Pocock's [`teach`](https://github.com/mattpocock/skills/tree/main/skills/productivity/teach) and `animatic` skills from [mattpocock/skills](https://github.com/mattpocock/skills). The engine is his `animatic`, vendored: see [`references/engine/README.md`](references/engine/README.md).
