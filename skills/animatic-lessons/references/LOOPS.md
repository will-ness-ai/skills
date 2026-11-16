# The two loops

Run both on every lesson, in this order. The screenshot loop judges each frame against its own line. The learner loop judges the lesson against the lessons before it and the story as a whole. Neither sees what the other sees.

## Screenshot loop

After a clean build, open **every** frame at full size (`build/NN.png`), with its line beside it. animatic's sheet is for pacing; it is too small for this.

Write one line per frame in `critique.md` under `## Pass 1`: the flaw, or `ok`. Be a critic. For each frame ask:

- Is the lit thing the brightest thing on the frame, and is it what the line quotes?
- Does every arrow meet its boxes? Does any label sit on a line, or collide with another?
- Is any text a viewer must read too dim, or under 28px?
- Is more than half the frame empty?
- Does a label claim something false? ("WireGuard" on a crossed-out arrow says WireGuard is blocked.)
- Does the line describe one value while the frame shows another?
- Is anything below y = 930, under the captions?
- **Is this the best picture for this line?** Where a lit box only points at the idea, propose the picture that carries it.

Fix what you found. A flaw in a shared component is fixed in `assets/`, so every lesson gains. Rebuild, re-read the changed frames, and record `## Pass 2`. A fix can be worse than the flaw; the second pass is what catches it.

Done when a pass over the changed frames finds nothing to fix. Two passes is usual; stop at three and report what is left.

## Learner loop

Give the lesson to a **learner**: a fresh subagent that has none of your context, so it meets the lesson the way the user will. With no subagent tool, do it yourself last, from the built files only, and say so at hand-over.

Brief it with the user's background and goal as you understand them, and this, filled in:

```
You are a learner: <background>. Your goal: <goal>.

The course is in <course>/lessons/. Read-only. First read the transcripts of the
lessons before <N> (in each index.html) to know what you have been taught. Leave
research.md, critique.md and the answers on each page closed until step 5.

Then take lesson <N> the way a learner does: for each moment in order, look at
build/NN.png at full size while reading that moment's line. Once through, in order.

Report by moment number:
1. Where you got lost, or a term, command or flag was used before it was explained.
2. What you needed and did not get (what would you search for straight after?),
   and what you would cut to make room. A lesson holds two ideas in 90 seconds.
3. Where an example was abstract or did not fit your goal, and the specific
   example that would.
4. Where the picture and the line disagreed, or the picture did not help.
5. Without looking back: each idea in your own words. Then open the recall
   questions: which could you not answer from the video alone?
6. Could you do this on your own machine now? Where would you first get stuck?

End with the five highest-value changes, ranked. "It was clear" only where it was.
```

Then revise. The learner reports what it missed; it guesses at the fix. Check each proposed fact against `research.md` before using it, and answer a point you reject with the source that settles it. Rebuild, and run one screenshot pass over the changed frames.

Done when every ranked change is made or answered, and every recall question is answerable from the video.
