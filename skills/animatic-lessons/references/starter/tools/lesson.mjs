#!/usr/bin/env node
// tools/lesson.mjs: build one lesson of a course of animatics.
//
//   ANIMATIC=<animatic-lessons skill>/references/engine/scripts/animatic.mjs \
//   node tools/lesson.mjs build <lesson-folder> [engine flags, e.g. --target 90 --engine kokoro]
//
// build runs four steps; each is also a verb of its own:
//   expand    storyboard.src.json -> storyboard.json + frames/NN.html (one stub per map moment)
//   (the engine's build -> build/nocap.mp4, build/NN.png, build/timeline.json, sheet.png, poster.png)
//   captions  timeline + each moment's text -> captions.vtt, burned into animatic.mp4
//   page      lesson.json + transcript -> index.html   (no folder named: every lesson)
// And one more verb, for the screenshot loop before any voice is spent:
//   frames    expand, then the engine's render: build/NN.png and sheet.png only
//
// The course folder is the lesson folder's grandparent:
//   course.json   { "title", "map": { grid, nodes, zones, edges, show } }   (map is optional)
//   assets/       map.js, map.css, frames.css, lesson.css   (house.css is copied in from the kit)
//   lessons/NNNN-slug/
//     storyboard.src.json   { "scene": { title, add: { nodes, zones, edges }, show }, "moments": [...] }
//     lesson.json           { title, lede, pretest, pretestAnswer, remember, questions: [{ q, a }],
//                             sources: [{ title, url }] (primary first), note }
//
// A moment is an animatic storyboard entry, plus two optional fields:
//   "text"  the line as it is READ ("port 22"); "say" is how the voice needs it ("port twenty-two").
//           Captions and the transcript use text, falling back to say.
//   "map"   a CHANGE to the shared map: { show: [ids], hide: [ids], lit: id|group, set: { id: {...} }, title }.
//           show/hide/set/title carry on through the lesson; lit is per moment (none = overview).
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [verb, lessonArg, ...flags] = process.argv.slice(2);
const die = (m) => { console.error(`lesson: ${m}`); process.exit(1); };
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const maybe = (p, d) => (fs.existsSync(p) ? json(p) : d);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const clock = (s) => { const t = Math.round(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const merge = (base = [], extra = []) => {
  const out = base.map((x) => ({ ...x }));
  for (const x of extra) {
    const i = out.findIndex((o) => o.id === x.id);
    if (i >= 0) out[i] = { ...out[i], ...x }; else out.push({ ...x });
  }
  return out;
};

function expand(dir) {
  const course = path.resolve(dir, "../.."), assets = path.join(course, "assets");
  const src = json(path.join(dir, "storyboard.src.json"));
  const moments = Array.isArray(src) ? src : src.moments;
  const scene = (Array.isArray(src) ? null : src.scene) ?? {};
  const base = maybe(path.join(course, "course.json"), {}).map ?? {};
  const all = { nodes: merge(base.nodes, scene.add?.nodes), zones: merge(base.zones, scene.add?.zones), edges: merge(base.edges, scene.add?.edges) };
  const ids = [...all.nodes, ...all.zones, ...all.edges].map((x) => x.id);
  // The version rides in each stub, so a change to the component re-renders every frame.
  const v = createHash("sha1").update(["map.js", "map.css", "house.css"].map((f) => (fs.existsSync(path.join(assets, f)) ? fs.readFileSync(path.join(assets, f)) : "")).join("")).digest("hex").slice(0, 8);
  fs.rmSync(path.join(dir, "frames"), { recursive: true, force: true });
  const state = { title: scene.title, show: new Set(scene.show ?? base.show ?? ids), set: {} };
  let maps = 0;
  const out = moments.map(({ text, map, ...rest }, i) => {
    if (!map) return rest;
    for (const id of [...(map.show ?? []), ...(map.hide ?? []), ...Object.keys(map.set ?? {}), ...(map.lit ? [map.lit] : [])])
      if (!ids.includes(id) && !all.edges.some((e) => e.group === id)) die(`moment ${i + 1}: the map has no "${id}"`);
    for (const id of map.show ?? []) state.show.add(id);
    for (const id of map.hide ?? []) state.show.delete(id);
    for (const [id, change] of Object.entries(map.set ?? {})) state.set[id] = { ...state.set[id], ...change };
    if (map.title !== undefined) state.title = map.title;
    const apply = (list) => list.map((x) => ({ ...x, ...state.set[x.id] }));
    const full = { title: state.title, grid: base.grid, nodes: apply(all.nodes), zones: apply(all.zones), edges: apply(all.edges), show: [...state.show], lit: map.lit ?? null };
    const name = `frames/${String(i + 1).padStart(2, "0")}.html`;
    fs.mkdirSync(path.join(dir, "frames"), { recursive: true });
    fs.writeFileSync(path.join(dir, name), `<!doctype html>\n<meta charset="utf-8">\n<link rel="stylesheet" href="../../../assets/house.css">\n<link rel="stylesheet" href="../../../assets/map.css">\n<body>\n<script>window.MAP = ${JSON.stringify(full)};</script>\n<script src="../../../assets/map.js?v=${v}"></script>\n`);
    maps++;
    return { ...rest, html: name };
  });
  fs.writeFileSync(path.join(dir, "storyboard.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`expand: ${out.length} moments, ${maps} map frames`);
}

function engine(dir, verb) {
  const script = process.env.ANIMATIC;
  if (!script || !fs.existsSync(script)) die("set ANIMATIC to the animatic-lessons skill's references/engine/scripts/animatic.mjs");
  const assets = path.resolve(dir, "../../assets");
  // Map frames link the kit's stylesheet from assets/, so keep a copy there.
  fs.copyFileSync(path.resolve(path.dirname(script), "../kit/house.css"), path.join(assets, "house.css"));
  fs.mkdirSync(path.join(dir, "build"), { recursive: true });
  // The course's frames.css, then the lesson's own, layered over the kit for generated frames.
  const css = [path.join(assets, "frames.css"), path.join(dir, "frames.css")].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  fs.writeFileSync(path.join(dir, "build/frames.css"), css);
  const out = verb === "build" ? ["-o", "build/nocap.mp4"] : [];
  const r = spawnSync("node", [script, verb, "storyboard.json", ...out, "--sheet", "sheet.png", "--css", "build/frames.css", ...flags], { cwd: dir, stdio: "inherit" });
  if (r.status !== 0) die(`the engine's ${verb} stopped; fix what it printed and run it again`);
  // The lesson's thumbnail: its opening card.
  if (fs.existsSync(path.join(dir, "build/01.png"))) fs.copyFileSync(path.join(dir, "build/01.png"), path.join(dir, "poster.png"));
}

const timeline = (dir) => { const t = maybe(path.join(dir, "build/timeline.json"), null) ?? maybe(path.join(dir, "timeline.json"), null); return t ? t.moments ?? t : null; };
const texts = (dir) => { const s = json(path.join(dir, "storyboard.src.json")); return (Array.isArray(s) ? s : s.moments).map((m) => m.text ?? m.say ?? ""); };

function captions(dir) {
  const tl = timeline(dir), lines = texts(dir), clean = path.join(dir, "build/nocap.mp4"), out = path.join(dir, "animatic.mp4");
  if (!tl || !fs.existsSync(clean)) die("no build/nocap.mp4 or build/timeline.json; run build first");
  if (tl.length !== lines.length) die(`timeline has ${tl.length} moments, storyboard.src.json has ${lines.length}; rebuild`);
  // Kept beside the lesson, so the page can be regenerated after build/ is gone.
  fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(tl.map(({ n, cut, start, seconds }) => ({ n, cut, start, seconds }))) + "\n");
  const wrap = (s, w = 42) => s.split(/\s+/).reduce((rows, word) => { const last = rows[rows.length - 1]; if (last !== undefined && (last + " " + word).length <= w) rows[rows.length - 1] = last + " " + word; else rows.push(word); return rows; }, []);
  const cues = [];
  tl.forEach((m, i) => {
    if (!lines[i]) return;
    // One cue per sentence, at most two rows of 42 characters; time shared by length.
    const chunks = lines[i].replace(/`/g, "").split(/(?<=[.?!:])\s+/).flatMap((s) => { const w = wrap(s); return Array.from({ length: Math.ceil(w.length / 2) }, (_, k) => w.slice(k * 2, k * 2 + 2).join("\n")); });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    let t = m.start;
    for (const c of chunks) { const d = (m.seconds * c.length) / total; cues.push([t, t + d, c]); t += d; }
  });
  const ts = (t, sep) => `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${(t % 60).toFixed(3).padStart(6, "0").replace(".", sep)}`;
  fs.writeFileSync(path.join(dir, "captions.vtt"), "WEBVTT\n\n" + cues.map(([a, b, c]) => `${ts(a, ".")} --> ${ts(b, ".")}\n${c}\n\n`).join(""));
  fs.writeFileSync(path.join(dir, "build/captions.srt"), cues.map(([a, b, c], i) => `${i + 1}\n${ts(a, ",")} --> ${ts(b, ",")}\n${c}\n\n`).join(""));
  const style = "FontSize=12,PrimaryColour=&H00FFFFFF,BorderStyle=4,BackColour=&HB0000000,Outline=0,Shadow=0,MarginV=14";
  // Always burned from the clean video, so running this again never doubles the captions.
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", "build/nocap.mp4", "-vf", `subtitles=build/captions.srt:force_style='${style}'`, "-c:v", "libx264", "-r", "30", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "copy", "animatic.mp4"], { cwd: dir, stdio: ["ignore", "inherit", "pipe"] });
  if (r.status !== 0) {
    fs.copyFileSync(clean, out);
    console.log(`WARN captions: ffmpeg could not burn them in (${String(r.stderr).trim().split("\n").pop()}). animatic.mp4 has none; captions.vtt still works on the lesson page.`);
  } else console.log(`captions: ${cues.length} cues burned into animatic.mp4`);
}

function page(dir) {
  const course = path.resolve(dir, "../.."), info = maybe(path.join(course, "course.json"), {});
  const all = fs.readdirSync(path.join(course, "lessons")).sort().filter((s) => fs.existsSync(path.join(course, "lessons", s, "lesson.json")));
  const slug = path.basename(dir), l = json(path.join(dir, "lesson.json")), tl = timeline(dir), lines = texts(dir);
  const total = tl ? tl[tl.length - 1].start + tl[tl.length - 1].seconds : null;
  const nav = all.map((s, i) => { const t = json(path.join(course, "lessons", s, "lesson.json")).title; return s === slug ? `<strong>${i + 1}. ${esc(t)}</strong>` : `<a href="../${s}/index.html">${i + 1}. ${esc(t)}</a>`; }).join("");
  const [primary] = l.sources ?? [];
  fs.writeFileSync(path.join(dir, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(l.title)}</title><link rel="stylesheet" href="../../assets/lesson.css"></head><body><main>
<div class="kicker">${esc(info.title ?? "Course")} · Lesson ${all.indexOf(slug) + 1} of ${all.length}</div>
<h1>${esc(l.title)}</h1>
<p class="lede">${md(l.lede ?? "")}</p>
<div class="pretest"><strong>Guess first, before you press play:</strong> ${md(l.pretest)}</div>
<video controls preload="metadata" src="animatic.mp4"><track kind="captions" src="captions.vtt" srclang="en" label="English"></video>
${total ? `<p class="meta">${clock(total)} · ${lines.length} moments</p>` : ""}
<h2>Was your guess right?</h2>
<details><summary>Show the answer to the opening question</summary><p>${md(l.pretestAnswer)}</p></details>
<h2>Practice: answer from memory</h2>
<p>Write or say each answer <em>before</em> opening it. Recall, not recognition, is what makes it stick.</p>
${(l.questions ?? []).map(({ q, a }, k) => `<p class="q">${k + 1}. ${md(q)}</p><details><summary>Model answer</summary><p>${md(a)}</p></details>`).join("\n")}
<div class="remember"><strong>The one thing to remember.</strong> ${md(l.remember)}</div>
${primary ? `<h2>Read next</h2>\n<p>Primary source: <a href="${esc(primary.url)}">${esc(primary.title)}</a></p>` : ""}
<h2>Sources</h2>
<ul>${(l.sources ?? []).map((s) => `<li><a href="${esc(s.url)}">${esc(s.title)}</a></li>`).join("")}</ul>
${l.note ? `<p class="meta">${md(l.note)}</p>` : ""}
<h2>Transcript</h2>
<ol class="transcript">${lines.map((t, k) => `<li${k && tl?.[k]?.cut ? ' class="cut"' : ""}><span class="meta">${tl?.[k] ? clock(tl[k].start) : ""}</span> ${md(t)}</li>`).join("\n")}</ol>
<p class="ask">Something unclear? Ask the agent that made this lesson a follow-up question.</p>
<nav class="series">${nav}</nav>
</main></body></html>
`);
  console.log(`page: ${slug}/index.html`);
}

const dirs = (course = ".") => { const root = path.resolve(course, "lessons"); if (!fs.existsSync(root)) die("name a lesson folder, or run from the course folder"); return fs.readdirSync(root).sort().map((s) => path.join(root, s)).filter((d) => fs.existsSync(path.join(d, "lesson.json"))); };
const dir = lessonArg ? path.resolve(lessonArg) : null;
if (dir && !fs.existsSync(path.join(dir, "storyboard.src.json"))) die(`${lessonArg}: no storyboard.src.json`);
if (verb === "build" && dir) { expand(dir); engine(dir, "build"); captions(dir); dirs(path.resolve(dir, "../..")).forEach(page); } // every page: the series nav changed
else if (verb === "expand" && dir) expand(dir);
else if (verb === "frames" && dir) { expand(dir); engine(dir, "render"); } // frames and sheet only: no voice, no video
else if (verb === "captions" && dir) captions(dir);
else if (verb === "page") (dir ? [dir] : dirs()).forEach(page);
else die("usage: lesson.mjs build|frames|expand|captions|page <lesson-folder> [engine flags]");
