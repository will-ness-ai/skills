#!/usr/bin/env node
// Validates every mermaid diagram in a story, before you publish it.
//
//   skills/code-story/check-mermaid.mjs story.html [more.html ...]
//
// A broken diagram does not fail loudly. Mermaid draws a small error box in
// place of the picture, and the rest of the page renders around it, so a story
// can go out with a hole in it that nobody sees until a reader opens it.
//
// This runs the real mermaid the page itself loads, in the Chrome already on
// this machine, so a pass here means the same parser accepted the same text.
// Nothing is installed. @mermaid-js/parser cannot stand in for it: that package
// only carries the newer Langium grammars and answers "Unknown diagram type"
// for flowchart, sequenceDiagram, and stateDiagram.
//
// Every diagram goes through parse() and then render(). parse() catches the
// syntax, render() catches what only breaks once the layout runs.
//
// Set MERMAID_JS to a local mermaid.min.js to run with no network. Set CHROME
// to pick a different browser.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";

const CHROMES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
];

const MERMAID = process.env.MERMAID_JS || "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
const BUDGET = 30000;

const fail = (message) => {
  console.error(`check-mermaid: ${message}`);
  process.exit(2);
};

function chrome() {
  const wanted = process.env.CHROME;
  if (wanted) {
    if (!existsSync(wanted)) fail(`CHROME points at nothing: ${wanted}`);
    return wanted;
  }
  const found = CHROMES.find((path) => existsSync(path));
  if (!found) fail("found no Chrome — set CHROME to its path");
  return found;
}

// The raw inner HTML is carried across unchanged and put back inside a <pre>,
// so Chrome decodes the entities exactly as it would in the real page.
function diagrams(html) {
  const out = [];
  const re = /<pre\b[^>]*\bclass\s*=\s*["'][^"']*\bmermaid\b[^"']*["'][^>]*>([\s\S]*?)<\/pre>/gi;
  for (let m; (m = re.exec(html)); ) {
    out.push({
      raw: m[1],
      line: html.slice(0, m.index).split("\n").length,
      kind: m[1].replace(/^[\s\n]*/, "").split(/[\s\n]/)[0] || "?",
    });
  }
  return out;
}

function harness(items) {
  const src = items.map((d) => `<pre class="mermaid">${d.raw}</pre>`).join("\n");
  return `<meta charset="UTF-8">
<div id="src" style="display:none">
${src}
</div>
<div id="out"></div>
<script src="${MERMAID}"></script>
<script>
(async () => {
  const res = [];
  const nodes = [...document.querySelectorAll('#src pre.mermaid')];
  try {
    mermaid.initialize({ startOnLoad: false });
  } catch (e) {
    document.getElementById('out').textContent = encodeURIComponent(JSON.stringify(
      [{ i: -1, stage: 'load', msg: 'mermaid did not load: ' + (e && e.message || e) }]));
    return;
  }
  for (let i = 0; i < nodes.length; i++) {
    const text = nodes[i].textContent;
    let stage = '', msg = '';
    try {
      await mermaid.parse(text);
    } catch (e) { stage = 'parse'; msg = String(e && e.message || e); }
    if (!stage) {
      try {
        await mermaid.render('probe' + i, text);
      } catch (e) { stage = 'render'; msg = String(e && e.message || e); }
    }
    res.push({ i, stage, msg });
  }
  document.getElementById('out').textContent = encodeURIComponent(JSON.stringify(res));
})();
</script>`;
}

function validate(items) {
  const page = join(tmpdir(), `check-mermaid-${process.pid}.html`);
  writeFileSync(page, harness(items));
  let dom;
  try {
    dom = execFileSync(chrome(), [
      "--headless",
      "--disable-gpu",
      `--virtual-time-budget=${BUDGET}`,
      "--dump-dom",
      `file://${page}`,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } finally {
    try { unlinkSync(page); } catch {}
  }
  const m = dom.match(/<div id="out">([^<]*)<\/div>/);
  if (!m || !m[1]) {
    fail("Chrome returned no result — mermaid may not have loaded (no network? try MERMAID_JS)");
  }
  return JSON.parse(decodeURIComponent(m[1]));
}

const files = process.argv.slice(2).filter((a) => !a.startsWith("-"));
if (files.length === 0) fail("usage: check-mermaid.mjs story.html [more.html ...]");

let bad = 0;
let total = 0;

for (const file of files) {
  if (!existsSync(file)) fail(`no such file: ${file}`);
  const items = diagrams(readFileSync(file, "utf8"));
  console.log(`${file} — ${items.length} diagram${items.length === 1 ? "" : "s"}`);
  if (items.length === 0) continue;

  const results = validate(items);
  const load = results.find((r) => r.i === -1);
  if (load) fail(load.msg);

  for (const r of results) {
    const d = items[r.i];
    total += 1;
    if (!r.stage) {
      console.log(`  ok    line ${String(d.line).padEnd(5)} ${d.kind}`);
    } else {
      bad += 1;
      console.log(`  FAIL  line ${String(d.line).padEnd(5)} ${d.kind}  (${r.stage})`);
      for (const line of r.msg.split("\n").slice(0, 6)) console.log(`          ${line}`);
    }
  }
}

console.log();
if (bad > 0) {
  console.error(`${bad} of ${total} diagram${total === 1 ? "" : "s"} invalid.`);
  process.exit(1);
}
console.log(`all ${total} diagram${total === 1 ? "" : "s"} valid.`);
