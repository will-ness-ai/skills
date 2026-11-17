// The library: every course is a folder under LIBRARY, laid out as the skill's
// starter kit lays it out (references/KIT.md). The folders are the truth; nothing
// about a course or a lesson is stored in the database.
import fs from "node:fs";
import path from "node:path";
import { LIBRARY } from "./db.mjs";

const json = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } };
const first = (dir, names) => names.find((n) => fs.existsSync(path.join(dir, n))) ?? null;
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };

export function lesson(course, slug, { detail = false } = {}) {
  const dir = path.join(LIBRARY, course, "lessons", slug);
  const info = json(path.join(dir, "lesson.json"), {});
  const tl = json(path.join(dir, "timeline.json")) ?? json(path.join(dir, "build/timeline.json"));
  const moments = tl ? tl.moments ?? tl : null;
  const video = fs.existsSync(path.join(dir, "animatic.mp4"));
  const poster = first(dir, ["poster.png", "build/01.png"]);
  const out = {
    course, slug, title: info.title ?? slug.replace(/^\d+-/, "").replace(/-/g, " "), lede: info.lede ?? "",
    seconds: moments?.length ? Math.round(moments.at(-1).start + moments.at(-1).seconds) : null,
    video: video ? `/library/${course}/lessons/${slug}/animatic.mp4` : null,
    captions: fs.existsSync(path.join(dir, "captions.vtt")) ? `/library/${course}/lessons/${slug}/captions.vtt` : null,
    poster: poster ? `/library/${course}/lessons/${slug}/${poster}` : null,
    updated: mtime(path.join(dir, video ? "animatic.mp4" : "lesson.json")),
  };
  if (!detail) return out;
  const src = json(path.join(dir, "storyboard.src.json")) ?? json(path.join(dir, "storyboard.json"), []);
  const lines = (Array.isArray(src) ? src : src.moments ?? []).map((m) => m.text ?? m.say ?? "");
  // What exists of the video so far: rendered frames, the sheet, the video itself.
  const build = path.join(dir, "build");
  const frames = fs.existsSync(build) ? fs.readdirSync(build).filter((f) => /^\d+\.png$/.test(f)).sort().map((f) => ({ url: `/library/${course}/lessons/${slug}/build/${f}?v=${Math.round(mtime(path.join(build, f)))}`, n: Number(f.slice(0, -4)) })) : [];
  return {
    ...out, ...info, slug, course,
    transcript: lines.map((text, i) => ({ text, start: moments?.[i]?.start ?? null, cut: Boolean(moments?.[i]?.cut) })),
    frames,
    sheet: fs.existsSync(path.join(dir, "sheet.png")) ? `/library/${course}/lessons/${slug}/sheet.png?v=${Math.round(mtime(path.join(dir, "sheet.png")))}` : null,
  };
}

export function course(slug, opts) {
  const dir = path.join(LIBRARY, slug);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const info = json(path.join(dir, "course.json"), {});
  const ldir = path.join(dir, "lessons");
  const slugs = fs.existsSync(ldir) ? fs.readdirSync(ldir).sort().filter((s) => fs.existsSync(path.join(ldir, s, "lesson.json")) || fs.existsSync(path.join(ldir, s, "storyboard.src.json"))) : [];
  return { slug, title: info.title ?? slug, about: info.about ?? "", lessons: slugs.map((s) => lesson(slug, s, opts)) };
}

export function courses() {
  if (!fs.existsSync(LIBRARY)) return [];
  return fs.readdirSync(LIBRARY).sort().filter((s) => !s.startsWith(".")).map((s) => course(s)).filter(Boolean)
    .sort((a, b) => Math.max(0, ...b.lessons.map((l) => l.updated)) - Math.max(0, ...a.lessons.map((l) => l.updated)));
}
