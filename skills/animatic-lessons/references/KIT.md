# The starter kit

`references/starter/` is copied into a new course folder. It needs Node 18+ and ffmpeg; the engine ([`engine/`](engine/README.md)) installs Playwright and Shiki itself on the first build.

```
<course>/
  course.json            the course's title and its shared map
  research.md            sources, what each settles, Gaps
  README.md              lessons made, the frontier as offered
  assets/                map.js, map.css   the map component
                         frames.css        layered over the engine's kit for generated frames
                         lesson.css        the lesson pages' stylesheet
  tools/lesson.mjs       the build
  lessons/NNNN-<slug>/
    storyboard.src.json  the lesson's one source: scene + moments
    lesson.json          the lesson page's content (LESSON.md)
    frames.css           optional: this lesson's own overrides for generated frames
```

Everything in `assets/` and `tools/` is the course's to change. A flaw the screenshot loop finds in the map is fixed in `assets/map.js`; a kind of picture the course keeps needing becomes a new component beside it.

## The build

```
ANIMATIC=<engine>/scripts/animatic.mjs node tools/lesson.mjs build lessons/NNNN-<slug> [animatic flags]
```

Flags after the folder go to the engine's `build` unchanged: the voice flags, `--target 90`. The build writes, in the lesson folder:

- `storyboard.json` and `frames/` (generated: edit `storyboard.src.json`, never these)
- `build/` (the engine's cache: `NN.png` per moment, `timeline.json`, `nocap.mp4`, the clean video)
- `sheet.png`, `animatic.mp4` (captions burned in), `captions.vtt`, `timeline.json`, `index.html`

Single steps: `lesson.mjs expand|captions <lesson>`, and `lesson.mjs page [<lesson>]` (no folder: every page, from the course folder).

Where ffmpeg has no subtitle filter, the build prints `WARN captions`, ships the video clean, and the page still plays `captions.vtt`. Say so at hand-over.

### What to commit

Source and finished lessons are the course; caches are not. Ignore, relative to the course folder:

```
lessons/*/build/
lessons/*/frames/
lessons/*/storyboard.json
assets/house.css
```

Videos are a few megabytes each. Where the project keeps binaries out of git, ignore `lessons/*/animatic.mp4` too and say where the videos are.

## storyboard.src.json

```json
{
  "scene": { "title": "Your tailnet", "add": { "nodes": [], "zones": [], "edges": [] }, "show": ["laptop", "devbox"] },
  "moments": [
    { "say": "…", "text": "…", "frame": { "type": "title", "headline": "…" } },
    { "say": "…", "map": { "show": ["sandbox"], "lit": "sandbox" } },
    { "say": "…", "map": { "set": { "sandbox": { "sub": "tag:server" } }, "lit": "sandbox" } }
  ]
}
```

A moment is an engine storyboard entry (`frame`, `html`, `image`, or none for a Reveal; [`FRAMES.md`](engine/FRAMES.md)) with two additions: `text` (LESSON.md, "Two texts per moment") and `map`. A lesson with no map moments can be a plain array of moments.

## The map

`course.json` holds the base picture; a lesson's `scene.add` adds to it for that lesson, and an item reusing a base `id` changes that item.

```json
{
  "title": "Tailscale",
  "map": {
    "grid": { "cols": [230, 595, 960, 1325, 1690], "rows": [200, 500, 800] },
    "nodes": [{ "id": "laptop", "col": 0, "row": 1, "title": "your laptop", "sub": "optional second line" }],
    "zones": [{ "id": "cafe", "label": "café Wi-Fi", "from": [0, 1], "to": [0, 1] }],
    "edges": [{ "id": "direct", "from": "laptop", "to": "devbox", "arrows": "both", "label": "WireGuard" }],
    "show": ["laptop", "devbox", "cafe", "direct"]
  }
}
```

- **Nodes** sit on the grid by `col` and `row` (or `x`, `y` in pixels). **Zones** box a run of cells and carry a label. **Edges** join two nodes: `style` `solid` or `dashed`; `arrows` `end`, `both` or `none`; `group` lets several edges light as one path; `shift` moves one of two parallel edges sideways; `labelAt` (0 to 1) and `labelSide` (1 or -1) place the label.
- **`show`** is what is visible at the start. Everything else is laid out and hidden, so the picture holds still as things appear.

A moment's `map` is one **change**:

| key | effect | lasts |
|---|---|---|
| `show`, `hide` | ids that appear or disappear | the rest of the lesson |
| `set` | `{ id: { sub, title, label, state } }`: node `state` `off`; edge `state` `blocked` or `ok` | the rest of the lesson |
| `title` | the overline, top left | the rest of the lesson |
| `lit` | the one id or edge group this moment lights; leave out for an overview | this moment |

Change one thing per moment: that is what makes a map moment a Reveal.

The engine counts each map moment as a Cut, since each is its own page. Count Cuts for STYLE.md's pacing rules by hand: consecutive map moments are one Cut and its Reveals.

To look at a state by hand, open `assets/map.html?s=<url-encoded state>` or any `frames/NN.html`.

## The example

`references/example/` is one lesson's source from a Tailscale course, with its course's `course.json`: `lesson.json`, `storyboard.src.json` (title cards, map moments, two terminals), `critique.md` from its screenshot loop, and `learner-review.md` from the learner loop over three lessons. Read it for shape; a new course writes its own.
