# A lesson

A lesson is watched once, then practised from memory. Everything below serves one of those two.

## Shape

- **Two ideas at most**, 60 to 90 seconds. The opening card, the closing card and one moment per new term leave room for about two. A third idea is the next lesson.
- **Open on a guess.** The first moment is a title card asking a question the lesson answers, in the cast's terms ("Your dev box is at home and you're in a café. What has to be open on it?"). Guessing first makes the answer stick, right or wrong.
- **Close on the one thing to remember**: a title card, one sentence, the same sentence as `remember` in `lesson.json`.
- **Stand on the lessons before.** Use what earlier lessons set up (their terms, their policy file, their commands), and never contradict it. When this lesson's command would fail under something an earlier lesson taught, show the change that makes it work.
- **Give the reason before the mechanism**: a problem this user has, in the cast's terms, by the second moment.

## Two texts per moment

A moment's `"say"` is for the voice, spelt as it is spoken ("S S H", "port twenty-two", "dash dash S S H"). Its `"text"` is for the eye, written as it is read ("SSH", "port 22", `--ssh` in backticks). Captions and the transcript use `text`. Write `text` on every moment where the two differ.

## Real content, in the cast's names

Every fact, command, flag, field and line of output comes from a source in `research.md`.

Sources print placeholders (`<ip-port>`, `device-a`) and strangers' names. Put the **cast** in their place: the format is the source's, the values are the course's, and the same machine keeps the same name and address in every lesson. Say so in `lesson.json`'s `note` ("values are illustrative; the format is from …").

What the sources do not show stays off the screen: output you would have to invent, a behaviour no page states. Put the open question in `research.md`'s Gaps and, where the learner will hit it, in `note`.

## Pictures

- **The map first.** A relationship, a path, a before-and-after: draw it as a change to the course's map ([`KIT.md`](KIT.md)). One change per moment.
- **The picture carries the claim.** "Nobody outside can open it" is a crossed arrow from outside, where a lit box only points. Draw the mechanism the line names: the hop, the block, the label that flips.
- **A demonstration agrees with itself.** When the story is "it's slow because it's relayed", the output on screen shows relayed, and the diagnostic shows the failing value.
- **Name the machine.** Title each terminal with the cast member it runs on. Two machines are two terminals.
- **Good and bad look different.** Colour a healthy value `ok` and a failing one `bad`.
- **Captions own the bottom band.** Keep content above y = 930.

## The lesson page

`lesson.json` fills the page beside the video:

```json
{
  "title": "Exit nodes: leave from home, wherever you are",
  "lede": "One sentence on what this lesson covers.",
  "pretest": "The opening guess, as on the first card.",
  "pretestAnswer": "Its answer, a short paragraph.",
  "remember": "The one thing to remember.",
  "questions": [{ "q": "A recall question.", "a": "A model answer." }],
  "sources": [{ "title": "Primary source, read next", "url": "https://…" }],
  "note": "Illustrative values, steps left out of the video, open questions."
}
```

Write three **recall questions**. Each makes the learner produce an answer (explain, write the command, diagnose a symptom), and each is answerable from the video alone: check every one against the narration after the last edit.
