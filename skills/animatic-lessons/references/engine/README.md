# The engine

The animatic engine: one storyboard in, one narrated MP4 of still frames out.

```
scripts/animatic.mjs   build: plan gate, frames (Playwright), voice, video (ffmpeg), sheet, verify
scripts/frames.mjs     the generated frame types
kit/                   house.css, the stylesheet every frame stands on, and example pages
STYLE.md               how an animatic is written: Cuts and Reveals, lines, frames, the sheet checklist
FRAMES.md              the generated frame types and their fields
VOICE.md               choosing and testing a voice
kit/README.md          writing a page of your own for a frame the types cannot show
```

`tools/lesson.mjs` in a course drives `animatic.mjs`; nothing here is run by hand except `say`, to test a voice. The first build installs Playwright and Shiki into `~/.cache/animatic` (`$ANIMATIC_HOME` moves it).

## Origin

Vendored from Matt Pocock's `animatic` and `setup-animatic` skills, [mattpocock/skills](https://github.com/mattpocock/skills) branch `animatic-skill` at commit `7100905` (13 Nov 2026), MIT licensed. `scripts/` and `kit/` are unchanged; the three guides are his, with pointers to his other files adjusted. To take his later fixes, copy those files over these.
