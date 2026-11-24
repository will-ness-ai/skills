// How a proof step's evidence file reaches the page: images and video as media, text files as terminal output.
import fs from "node:fs";
import path from "node:path";
export const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };
export const INLINE_LIMIT = 6 * 1024 * 1024;
// Fill in step.src (a URL for media) or step.term (text), given a function that turns a media step into a URL.
export function present(step, url) {
  if (!step.evidence || !fs.existsSync(step.evidence)) return step;
  const ext = path.extname(step.evidence).toLowerCase();
  if (MIME[ext]) return { ...step, src: url(step, MIME[ext]) };
  const text = fs.readFileSync(step.evidence, "utf8");
  return { ...step, term: step.term ?? (text.length > 20000 ? text.slice(0, 20000) + `\n… (truncated, ${text.length} chars)` : text) };
}
export function withEvidence(state, url) {
  return { ...state, cards: state.cards.map((c) => (c.steps ? { ...c, steps: c.steps.map((s) => present(s, url)) } : c)) };
}
