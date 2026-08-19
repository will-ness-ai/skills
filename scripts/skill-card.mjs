#!/usr/bin/env node
// Renders one skill as a GitHub-style PNG card, sized for a post on X, and puts
// it on the clipboard.
//
//   scripts/skill-card.mjs flashlight
//
// The card is the repo header — owner, avatar, stars, description — above the
// first lines of that skill's SKILL.md, with its front matter highlighted the
// way GitHub highlights a permalink.
//
// Repo facts come from `gh` at run time so the star count is never stale. The
// avatar is fetched once and cached. Everything else is local: the card uses
// system fonts, so rendering needs no network.
//
// Needs: Google Chrome, and `gh` authenticated. macOS for the clipboard step.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(homedir(), ".cache", "skill-card");

// X shows a 16:9 image without cropping it. Rendering at 2x keeps the source
// text sharp after X re-encodes the upload.
const WIDTH = 1200;
const HEIGHT = 675;
const SCALE = 2;

// How much of the file to put in the DOM. The panel clips well before this;
// anything more is only slower to render.
const MAX_LINES = 60;

const CHROMES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
];

/* ── args ───────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args.splice(i, 2)[1] ?? "";
};
const has = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return false;
  args.splice(i, 1);
  return true;
};

const outFlag = flag("--out");
const light = has("--light");
const noCopy = has("--no-copy");
const openIt = has("--open");
const skill = args[0];

if (!skill || skill === "--help" || skill === "-h") {
  console.log(`usage: scripts/skill-card.mjs <skill> [--light] [--out FILE] [--no-copy] [--open]

skills: ${skillNames().join(", ")}`);
  process.exit(skill ? 0 : 1);
}

/* ── the repo ───────────────────────────────────────────────────────── */

function skillNames() {
  // engineering/ holds redirect stubs for skills that moved, not real skills —
  // the same exclusion link-skills.sh and list-skills.sh make.
  return readdirSync(join(REPO, "skills"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "engineering")
    .filter((e) => existsSync(join(REPO, "skills", e.name, "SKILL.md")))
    .map((e) => e.name)
    .sort();
}

const skills = skillNames();
if (!skills.includes(skill)) {
  console.error(`skill-card: no skills/${skill}/SKILL.md`);
  console.error(`  available: ${skills.join(", ")}`);
  process.exit(1);
}

function sh(cmd, cmdArgs) {
  return execFileSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function nameWithOwner() {
  const url = sh("git", ["-C", REPO, "remote", "get-url", "origin"]);
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot read owner/name from remote: ${url}`);
  return m[1];
}

// Live facts, with the last good answer as a fallback so a flaky network or an
// expired gh token degrades to a stale star count instead of no card.
function repoFacts(nwo) {
  const cached = join(CACHE, `${nwo.replace("/", "_")}.json`);
  try {
    const raw = sh("gh", [
      "repo", "view", nwo,
      "--json", "stargazerCount,forkCount,description,licenseInfo,primaryLanguage",
    ]);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cached, raw);
    return JSON.parse(raw);
  } catch (err) {
    if (existsSync(cached)) {
      console.warn("skill-card: gh failed, using cached repo facts");
      return JSON.parse(readFileSync(cached, "utf8"));
    }
    throw new Error(`gh repo view failed and nothing is cached: ${err.message}`);
  }
}

function avatar(owner) {
  const file = join(CACHE, `${owner}.avatar`);
  if (!existsSync(file)) {
    mkdirSync(CACHE, { recursive: true });
    sh("curl", ["-sfL", `https://github.com/${owner}.png?size=160`, "-o", file]);
  }
  return `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`;
}

/* ── the skill file ─────────────────────────────────────────────────── */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Enough markdown colouring to look like GitHub's, and no more. Each line is
// tagged with whether it belongs to the front matter, which is what the card
// highlights.
function highlight(source) {
  let fences = 0;
  return source.split("\n").map((line) => {
    let html = esc(line);
    if (line.trim() === "---" && fences < 2) {
      fences++;
      return { html: '<span class="fm">---</span>', frontMatter: true };
    }
    if (fences === 1) {
      return {
        html: html.replace(/^([a-z][a-z-]*):/, '<span class="key">$1</span>:'),
        frontMatter: true,
      };
    }
    if (/^#{1,6}\s/.test(line)) return { html: `<span class="h">${html}</span>`, frontMatter: false };
    html = html.replace(/`([^`]+)`/g, '<span class="code">`$1`</span>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="b">**$1**</span>');
    return { html, frontMatter: false };
  });
}

function fileLines(path) {
  const source = readFileSync(path, "utf8");
  const lines = highlight(source);

  // The blank line that separates the front matter from the prose is dead space
  // on a card this short, so it is dropped. Line numbers stay contiguous rather
  // than jumping, which would read as a rendering fault.
  const close = lines.reduce((last, l, i) => (l.frontMatter ? i : last), -1);
  if (close >= 0 && lines[close + 1] && lines[close + 1].html === "") lines.splice(close + 1, 1);

  return {
    lines: lines.slice(0, MAX_LINES),
    count: source.replace(/\n$/, "").split("\n").length,
    bytes: Buffer.byteLength(source),
  };
}

/* ── the card ───────────────────────────────────────────────────────── */

const dark = {
  canvas: "#0d1117", subtle: "#151b23", rule: "#3d444d", ruleSoft: "#262c36",
  fg: "#f0f6fc", mut: "#9198a1", btn: "#212830", btnb: "#3d444d",
  star: "#e3b341", grn: "#3fb950", key: "#79c0ff", mark: "#1f2a3d", markb: "#316dca",
};
const bright = {
  canvas: "#ffffff", subtle: "#f6f8fa", rule: "#d1d9e0", ruleSoft: "#e4e8ed",
  fg: "#1f2328", mut: "#59636e", btn: "#f6f8fa", btnb: "#d1d9e0",
  star: "#bf8700", grn: "#1a7f37", key: "#0550ae", mark: "#ddf4ff", markb: "#54aeff",
};

const OCTICON = {
  repo: '<svg class="oct" viewBox="0 0 16 16"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>',
  star: '<svg class="oct" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>',
  fork: '<svg class="oct" viewBox="0 0 16 16"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/></svg>',
  file: '<svg class="oct" viewBox="0 0 16 16"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>',
};

// GitHub writes the licence as "MIT license" on a repo page.
function licenseLabel(info) {
  const label = info?.nickname || info?.name || "";
  return label.replace(/\bLicense\b/, "license");
}

function card({ owner, name, facts, avatarUri, skillName, file, skillCount, theme }) {
  const kb = `${(file.bytes / 1024).toFixed(1)} KB`;
  const rows = file.lines
    .map((l) => `<li class="${l.frontMatter ? "mark" : ""}"><span>${l.html || " "}</span></li>`)
    .join("");

  return `<!doctype html>
<meta charset="utf-8">
<title>${esc(skillName)}</title>
<style>
:root{
  --canvas:${theme.canvas}; --subtle:${theme.subtle}; --rule:${theme.rule}; --rule-soft:${theme.ruleSoft};
  --fg:${theme.fg}; --mut:${theme.mut}; --btn:${theme.btn}; --btnb:${theme.btnb};
  --star:${theme.star}; --grn:${theme.grn}; --key:${theme.key}; --mark:${theme.mark}; --markb:${theme.markb};
  /* GitHub's own stacks — no webfont, so the card renders offline and identically each run */
  --ui:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;
  display:flex;flex-direction:column;padding:38px 44px 36px;
  background:var(--canvas);color:var(--fg);font-family:var(--ui);
  font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;
}
.oct{width:1em;height:1em;fill:currentColor;flex:none;vertical-align:-.14em}
.mut{color:var(--mut);font-weight:400}

.top{display:flex;align-items:center;gap:.85rem}
.nwo{display:flex;align-items:center;gap:.5rem;font-size:33px;font-weight:600;letter-spacing:-.01em}
.nwo .oct{color:var(--mut);font-size:29px}
.pill{
  border:1px solid var(--rule);border-radius:999px;padding:.16em .7em;
  font-size:.62em;color:var(--mut);font-weight:500;line-height:1.7;
}
.top .right{margin-left:auto;display:flex;gap:.6rem}
.btn{
  display:inline-flex;align-items:center;gap:.45rem;background:var(--btn);
  border:1px solid var(--btnb);border-radius:7px;padding:.45rem .85rem;font-size:18px;font-weight:600;
}
.btn .cnt{border-left:1px solid var(--btnb);margin-left:.5rem;padding-left:.65rem}
.starred{color:var(--star)}

.desc{margin:16px 0 0;font-size:22px;line-height:1.4;max-width:40em}
.meta{display:flex;align-items:center;gap:1.3rem;margin-top:14px;font-size:16px;color:var(--mut)}
.meta .i{display:inline-flex;align-items:center;gap:.4rem}
.meta .who{gap:.5rem;margin-right:.2rem}
.meta .av{width:26px;height:26px;border-radius:50%;display:block;border:1px solid var(--rule)}
.meta .who b{color:var(--fg);font-weight:600;font-size:17px}
.meta .langdot{width:11px;height:11px;border-radius:50%;background:#e34c26;display:inline-block}

.file{
  margin-top:22px;border:1px solid var(--rule);border-radius:10px;overflow:hidden;
  display:flex;flex-direction:column;flex:1;min-height:0;
}
.fhead{
  display:flex;align-items:center;gap:.55rem;padding:12px 16px;background:var(--subtle);
  border-bottom:1px solid var(--rule);font-size:17px;font-weight:600;flex:none;
}
.fhead .oct{color:var(--mut);font-size:16px}
.fhead .fmeta{margin-left:auto;font-weight:400;color:var(--mut);font-size:14px;font-family:var(--mono)}
.body{flex:1;min-height:0;overflow:hidden;position:relative}
.body::after{
  content:"";position:absolute;left:0;right:0;bottom:0;height:64px;
  background:linear-gradient(transparent,var(--canvas));
}

ol{margin:0;padding:10px 0;list-style:none;counter-reset:ln;font-family:var(--mono)}
li{
  counter-increment:ln;display:flex;align-items:baseline;padding-right:16px;
  border-left:3px solid transparent;font-size:15.5px;line-height:1.74;
}
/* Real SKILL.md files are not hand-wrapped. Soft-wrapping keeps the ends of
   sentences on the card instead of clipping them at the panel edge; the
   continuation hangs clear of the gutter. */
li>span{flex:1;min-width:0;white-space:pre-wrap;overflow-wrap:break-word}
/* The gutter keeps one size and one width so the numbers stay aligned even
   where the source beside them shrinks. */
li::before{
  content:counter(ln);flex:none;width:58px;padding-right:16px;text-align:right;
  color:var(--mut);opacity:.6;font-size:13.5px;
}
/* Front matter: smaller than the prose, and tinted the way GitHub tints a
   permalinked range. */
li.mark{font-size:11.5px;line-height:1.52;background:var(--mark);border-left-color:var(--markb)}

.fm{color:var(--mut)}
.key{color:var(--key);font-weight:500}
.h{color:var(--key);font-weight:700}
.code{color:var(--grn)}
.b{font-weight:700}
</style>
<div class="top">
  <span class="nwo">${OCTICON.repo}<span class="mut">${esc(owner)}&nbsp;/</span>&nbsp;<b>${esc(name)}</b></span>
  <span class="pill">Public</span>
  <span class="right">
    <span class="btn">${OCTICON.fork}Fork<span class="cnt">${facts.forkCount}</span></span>
    <span class="btn"><span class="starred">${OCTICON.star}</span>Star<span class="cnt">${facts.stargazerCount}</span></span>
  </span>
</div>
<p class="desc">${esc(facts.description ?? "")}</p>
<div class="meta">
  <span class="i who"><img class="av" src="${avatarUri}" alt=""><b>${esc(owner)}</b></span>
  <span class="i"><span class="langdot"></span>${esc(facts.primaryLanguage?.name ?? "")}</span>
  <span class="i">${esc(licenseLabel(facts.licenseInfo))}</span>
  <span class="i">${skillCount} skills</span>
</div>
<div class="file">
  <div class="fhead">${OCTICON.file}<span class="mut">skills&nbsp;/&nbsp;${esc(skillName)}&nbsp;/</span>&nbsp;<b>SKILL.md</b>
    <span class="fmeta">${file.count} lines · ${kb}</span></div>
  <div class="body"><ol>${rows}</ol></div>
</div>
`;
}

/* ── render ─────────────────────────────────────────────────────────── */

function chrome() {
  const found = CHROMES.filter(Boolean).find((p) => existsSync(p));
  if (!found) throw new Error("no Chrome found — set CHROME to its path");
  return found;
}

function shoot(html, out) {
  const page = join(tmpdir(), `skill-card-${process.pid}.html`);
  writeFileSync(page, html);
  execFileSync(chrome(), [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    `--force-device-scale-factor=${SCALE}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${out}`,
    "--virtual-time-budget=2000",
    `file://${page}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  if (!existsSync(out)) throw new Error("Chrome produced no image");
}

function toClipboard(png) {
  if (process.platform !== "darwin") {
    console.warn("skill-card: clipboard copy is macOS-only, skipped");
    return false;
  }
  execFileSync("osascript", [
    "-e",
    `set the clipboard to (read (POSIX file "${png}") as «class PNGf»)`,
  ]);
  return true;
}

/* ── go ─────────────────────────────────────────────────────────────── */

const nwo = nameWithOwner();
const [owner, name] = nwo.split("/");
const facts = repoFacts(nwo);
const file = fileLines(join(REPO, "skills", skill, "SKILL.md"));
const out = outFlag ? resolve(outFlag) : join(tmpdir(), `${name}-${skill}.png`);

shoot(card({
  owner,
  name,
  facts,
  avatarUri: avatar(owner),
  skillName: skill,
  file,
  skillCount: skills.length,
  theme: light ? bright : dark,
}), out);

const copied = noCopy ? false : toClipboard(out);

console.log(`${out}  ${WIDTH * SCALE}x${HEIGHT * SCALE}  ★${facts.stargazerCount}${copied ? "  — on the clipboard" : ""}`);
if (openIt) execFileSync("open", [out]);
