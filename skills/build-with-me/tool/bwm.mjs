#!/usr/bin/env node
// bwm: the build-with-me page's command line. Its reader is an agent; it follows the
// `agent-tools` skill (AXI style: rows not prose, a home view, help[] next steps, flags only).
// State lives in <project>/.build-with-me/bwm.db (override with BWM_DIR); the page is drawn from it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { open, PHASES, STATUS, KINDS, UserError } from "./lib/store.mjs";
import "./page/reply.js"; // sets globalThis.BWMReply: the pasted-reply format and TOON cell quoting, shared with the page

const TOOL = path.dirname(fileURLToPath(import.meta.url));
// One store per project. bwm finds an existing one by walking up from here, so running it from a
// subfolder still reaches it; a new one goes at the project root (CLAUDE_PROJECT_DIR, else the git root).
function findStore() {
  if (process.env.BWM_DIR) return path.resolve(process.env.BWM_DIR);
  let git = null;
  for (let d = process.cwd(); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, ".build-with-me", "bwm.db"))) return path.join(d, ".build-with-me");
    if (!git && fs.existsSync(path.join(d, ".git"))) git = d;
    if (path.dirname(d) === d) break;
  }
  return path.join(process.env.CLAUDE_PROJECT_DIR ?? git ?? process.cwd(), ".build-with-me");
}
const DIR = findStore();
const REL = path.relative(process.cwd(), path.join(TOOL, "bwm.mjs"));
const q = (p) => (/\s/.test(p) ? `"${p}"` : p);
const BWM = process.env.BWM_CMD ?? `node ${q(REL.startsWith("..") ? path.join(TOOL, "bwm.mjs") : REL)}`;

// ---- output: TOON-shaped rows, key: value details, help[] blocks ----
const out = [];
const say = (...l) => out.push(...l);
// Line breaks and indentation survive (as \n inside a quoted value), so a human's nested bullets reach the agent intact.
const cell = (v) => globalThis.BWMReply.cell(v);
const rows = (name, fields, list, total) => {
  if (!list.length) return say(`${name}: none`);
  say(`${name}[${list.length}${total !== undefined && total !== list.length ? ` of ${total}` : ""}]{${fields.join(",")}}:`);
  for (const r of list) say("  " + fields.map((f) => cell(r[f])).join(","));
};
const kv = (o) => { for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") say(`${k}: ${String(v).replace(/\s+/g, " ")}`); };
const help = (...cmds) => { cmds = cmds.flat().filter(Boolean); if (cmds.length) { say(`help[${cmds.length}]:`); for (const c of cmds) say(`  ${c.startsWith("bwm") ? BWM + c.slice(3) : c}`); } };
const cut = (s, n = 900) => (s && s.length > n ? `${s.slice(0, n)}… (truncated, ${s.length} chars total; use --full)` : s);
const flush = (code = 0) => { if (out.length) process.stdout.write(out.join("\n") + "\n"); process.exit(code); };

// ---- commands: flags, help, run ----
// Flag types: s = string, n = number, b = boolean, l = repeatable list. A trailing ! marks it required.
const C = {
  start: { flags: { "title!": "s", "goal!": "s", why: "s", ask: "s", done: "l" }, args: "",
    about: "Start a goal: the page's heading, its one-sentence goal, why it matters, and what done looks like.",
    ex: ['bwm start --title "Phone access" --goal "Open the lessons site on your phone, away from the Mac" --why "Ideas come up on walks" --done "Phone can watch and request" --done "Nothing on the public internet"'] },
  goal: { flags: { title: "s", goal: "s", why: "s", ask: "s", today: "l", after: "l", picture: "s", "add-done": "l", "done-state": "l" }, args: "",
    about: "Show or change the goal, the ask, today vs after, the picture (an SVG file), and the done-when lines.",
    ex: ['bwm goal --ask "One decision and one check from you, then I can mark the PR ready."', 'bwm goal --today "The site only answers on the Mac" --after "Your phone reaches it over the private link"', "bwm goal --done-state 2=done"] },
  card: { flags: { phase: "s", title: "s", status: "s", note: "s", text: "s", "text-file": "s", diagram: "s", full: "b" }, args: "add | set <id> | show <id>",
    about: "Add, change or show a board card. --diagram <file.svg> puts a drawing at the top of the card (it replaces any drawing already there); draw it with the page's colours (the list is in the skill's references/briefs.md). Phases: understand, decide, prove, ship, watch. Statuses: answer and check (the human's turn), working and failed (yours), waiting, expected, done.",
    ex: ['bwm card add --phase understand --title "How Tailscale serve works" --status done --diagram serve.svg --text-file brief.md', 'bwm card set 7 --status failed --note "fixing 1 file"', "bwm card show 7"] },
  cards: { flags: { phase: "s", status: "s", kind: "s", all: "b" }, args: "",
    about: "List cards. Done cards are left out unless --all or --status done.",
    ex: ["bwm cards", "bwm cards --phase prove --all"] },
  ask: { flags: { "title!": "s", "topic!": "s", know: "l", option: "l", rec: "n", why: "s", flips: "s", "brief-file": "s", "read-first": "s", "shape-file": "s", phase: "s" }, args: "",
    about: "Ask the human a question, with everything they need to decide. It lands in their queue and as an open decision. --brief-file is markdown shown above the options: open with a ```svg diagram of the choice, then what matters about it. --read-first lists the Understand cards (ids, comma-separated) to read before answering. --option is \"<label>|<what happens if picked>|<evidence: what we saw, cost, risk>\", in order; --rec is the 1-based recommended option.",
    ex: ['bwm ask --topic "First win" --title "Which win should I deliver first?" --brief-file first-win.md --read-first 3,4 --option "Root CLAUDE.md|Every agent session starts with the team rules|Half a day; no game code touched; the 3 sessions this week each re-learned the rules" --option "Shared test command|One command runs every test|Days; first step to CI; today tests run 4 different ways" --rec 1 --why "Cheapest, and every later win builds on it" --flips "If the team already plans CI this sprint"'] },
  reask: { flags: { "whats-new!": "s", "read-first": "s", "brief-file": "s", know: "l", option: "l", rec: "n", why: "s", flips: "s" }, args: "<question card id>",
    about: "Ask a question again after the human said \"not sure\" or asked to be taught more: add the Understand cards they needed first, then reask with --read-first pointing at them and --whats-new saying what changed. The same card goes back to their turn; options and brief are replaced only when given.",
    ex: ['bwm reask 6 --read-first 7,8 --whats-new "Two new cards: how agents load CLAUDE.md vs AGENTS.md, and what each win costs"'] },
  decide: { flags: { "text!": "s", why: "s", topic: "s", answer: "s" }, args: "<question card id>",
    about: "Settle the decision behind an answered question: one plain sentence for the design, and why.",
    ex: ['bwm decide 4 --text "Phone requests go through when Tailscale says they come from you." --why "Only you should spend your tokens"'] },
  decision: { flags: { topic: "s", text: "s", status: "s", asked: "s", answer: "s", why: "s", pin: "s" }, args: "add | set <id>",
    about: "Add or change a decision directly (statuses: settled, open, next). --pin x,y places its number on the picture, in the SVG's own units.",
    ex: ['bwm decision add --topic "Coming next" --text "Whether each lesson remembers who asked for it." --status next', "bwm decision set 3 --pin 220,138"] },
  design: { flags: {}, args: "", about: "Show the design: goal, ask, today vs after, and every decision.", ex: ["bwm design"] },
  proof: { flags: { kind: "s", title: "s", claim: "s", setup: "l", planned: "b", did: "s", expected: "s", got: "s", evidence: "s", "term-file": "s", term: "s", text: "s", check: "b", note: "s", full: "b" },
    args: "add | step <id> | control <id> | try <id> | pass <id> | fail <id> | show <id>",
    about: "Record proof. Kinds: golden, edge, error, hardening. Each step says what you did, what should happen and what did, with evidence (a screenshot or video path, or captured terminal output). A control is a run that should fail (or succeed) to show the test can tell the difference. pass --check hands it to the human to verify.",
    ex: ['bwm proof add --kind hardening --title "The internet can\'t reach it" --claim "Nothing outside your tailnet reaches the site"', 'bwm proof step 9 --did "curl the site from a cloud VM" --expected "Name does not resolve" --got "Could not resolve host" --term-file /tmp/curl.txt', 'bwm proof control 9 --did "Same curl from your phone" --expected "Works" --got "HTTP/2 200" --term "HTTP/2 200"', "bwm proof pass 9", "bwm proof pass 8 --check"] },
  proofs: { flags: {}, args: "", about: "The coverage map: every proof by kind, so gaps show.", ex: ["bwm proofs"] },
  import: { flags: { reply: "s", "reply-file": "s" }, args: "", about: "Record answers the human pasted into chat from a rendered page (the answers[N] rows), then apply them like wait does.", ex: ["bwm import --reply-file reply.txt   (write the human's paste to the file first: no shell quoting)", "bwm import --reply '<the answers rows>'"] },
  answers: { flags: {}, args: "", about: "Apply the human's unread submissions to the board and print them. wait does this when one arrives.", ex: ["bwm answers"] },
  wait: { flags: { timeout: "n" }, args: "", about: "Wait for the human to submit from the page, then apply and print their answers. Run it in the background. Default timeout 1800 s.", ex: ["bwm wait", "bwm wait --timeout 600"] },
  serve: { flags: { port: "n" }, args: "", about: "Serve the live page on localhost, with Submit wired to this store. Run it in the background; it prints its URL.", ex: ["bwm serve", "bwm serve --port 4848"] },
  render: { flags: { out: "s" }, args: "", about: "Write the page as one self-contained HTML file (state and evidence inlined), to publish or open. Submit there copies a reply to paste into chat.", ex: ["bwm render", "bwm render --out page.html"] },
  hooks: { flags: { mode: "s", settings: "s" }, args: "install | uninstall | status",
    about: "Install the page hooks into this project's Claude Code settings (.claude/settings.local.json, or --settings <file>). They mirror your native task list onto the board, and run a classifier that names the page updates due. --mode shadow (the default) only records those in bwm shadow; --mode live hands them to you as hook messages.",
    ex: ["bwm hooks install", "bwm hooks install --mode live", "bwm hooks status", "bwm hooks uninstall"] },
  shadow: { flags: { all: "b", label: "s", should: "s", note: "s", limit: "n" }, args: "[show <id> | label <id>]",
    about: "The shadow log: each moment the classifier judged, what it would have asked for, and what you did on your own. Label each with right, wrong or missed (--should names the updates that were due) before hooks go live.",
    ex: ["bwm shadow", "bwm shadow show 12", 'bwm shadow label 12 --label missed --should "proof.attach" --note "the curl run proved card 9"', "bwm shadow --all"] },
  check: { flags: { url: "s" }, args: "", about: "Screenshot the page at desktop and phone width, light and dark, and report overflow and script errors. Needs Playwright. Read the screenshots and fix what looks wrong before showing the human.", ex: ["bwm check"] },
};

function parse(cmd, argv) {
  const spec = C[cmd], f = {}, args = [], known = {};
  for (const [k, t] of Object.entries(spec.flags)) known[k.replace("!", "")] = t;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help") { f.help = true; continue; }
    if (!a.startsWith("--")) { args.push(a); continue; }
    const k = a.slice(2), t = known[k];
    if (!t) throw usage(cmd, `unknown flag --${k}`);
    if (t === "b") { f[k] = true; continue; }
    const v = argv[++i];
    if (v === undefined) throw usage(cmd, `--${k} needs a value`);
    if (t === "n") { if (!Number.isFinite(Number(v))) throw usage(cmd, `--${k} needs a number, got "${v}"`); f[k] = Number(v); }
    else if (t === "l") (f[k] ??= []).push(v);
    else f[k] = v;
  }
  if (!f.help) for (const k of Object.keys(spec.flags)) if (k.endsWith("!") && f[k.slice(0, -1)] === undefined) throw usage(cmd, `missing --${k.slice(0, -1)}`);
  return { f, args };
}
function usage(cmd, msg) { const e = new UserError(msg); e.usage = cmd; return e; }
function cmdHelp(cmd) {
  const s = C[cmd];
  say(`usage: bwm ${cmd}${s.args ? " " + s.args : ""} ${Object.entries(s.flags).map(([k, t]) => { const n = k.replace("!", ""); const v = t === "b" ? "" : t === "l" ? ` <${n}>…` : ` <${n}>`; return k.endsWith("!") ? `--${n}${v}` : `[--${n}${v}]`; }).join(" ")}`.trimEnd());
  say(s.about, "examples:"); for (const e of s.ex) say(`  ${e.replace(/^bwm/, BWM)}`);
}
// A card's drawing is a ```svg block at the top of its body; the page draws it in the theme's colours.
const SVG_BLOCK = /^```svg\n[\s\S]*?\n```\n*/;
const hasDiagram = (body) => /^\s*```svg\n/.test(body ?? "");
function withDiagram(body, file) {
  if (!file) return body;
  const svg = readArg(file).trim();
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/.test(svg)) throw new UserError(`${file} is not an SVG: the file should start with <svg viewBox="0 0 W H"> (see references/briefs.md)`, ["bwm card set <id> --diagram <drawing.svg>"]);
  return `\`\`\`svg\n${svg.replace(/^<\?xml[^>]*>\s*/, "")}\n\`\`\`\n\n${String(body ?? "").replace(SVG_BLOCK, "")}`.trimEnd();
}
// Reads a file argument as text. UTF-16 (what Windows PowerShell 5.1 writes by default) is read too.
// Understand card ids for --read-first: each must exist and be an Understand note.
function readIds(st, v) {
  if (!v) return [];
  return String(v).split(/[\s,]+/).filter(Boolean).map((x) => {
    const n = Number(x); if (!Number.isInteger(n)) throw usage(CUR, `--read-first takes card ids, got "${x}"`);
    const c = st.card(n); if (c.phase !== "understand" || c.kind !== "note") throw new UserError(`card ${n} isn't an Understand card; --read-first points at what to read before answering`, ["bwm cards --phase understand --all"]);
    return n;
  });
}
// What a question is missing before it can teach: a brief, something to read first, evidence per option.
function askGaps(f, readFirst) {
  const g = [];
  if (!f["brief-file"] && !readFirst.length) g.push("no --brief-file and no --read-first");
  const bare = (f.option ?? []).filter((o) => !(o.split("|")[2] ?? "").trim()).length;
  if (bare) g.push(`${bare} option(s) without evidence (the third | part)`);
  return g;
}
const readArg = (p) => {
  if (!p) return undefined; if (!fs.existsSync(p)) throw new UserError(`no file at ${p}`);
  const b = fs.readFileSync(p);
  if (b[0] === 0xff && b[1] === 0xfe) return b.subarray(2).toString("utf16le");
  if (b[0] === 0xfe && b[1] === 0xff) { const s = Buffer.from(b.subarray(2)); s.swap16(); return s.toString("utf16le"); }
  return b.toString("utf8").replace(/^\uFEFF/, "");
};
let CUR = null; // the command running, so an id error can print its usage
const id1 = (args, what = "id") => { const n = Number(args[0]); if (!Number.isInteger(n)) throw usage(CUR, args[0] === undefined ? `name a ${what}` : `"${args[0]}" is not a ${what}`); return n; };
const owner = (s) => STATUS[s] ?? "-";

// ---- views ----
function noStore() { say("goal: none yet", `store: none (a new one would go at ${DIR})`); help('bwm start --title "<few words>" --goal "<one sentence>" --why "<why>" --done "<done when>"', "bwm --help"); }
function home(st) {
  const g = st.goal();
  if (!g) { say("goal: none yet", `store: ${path.relative(process.cwd(), DIR) || DIR}`); help('bwm start --title "<few words>" --goal "<one sentence>" --why "<why>" --done "<done when>"', "bwm --help"); return; }
  const cards = st.cards(), open = cards.filter((c) => c.status !== "done");
  const you = open.filter((c) => STATUS[c.status] === "you"), mine = open.filter((c) => STATUS[c.status] === "claude");
  const done = st.doneWhen(), decs = st.decisions(), proofs = cards.filter((c) => c.kind === "proof");
  kv({ goal: g.goal, title: g.title, ask: g.ask ?? "(none: set one with goal --ask)",
    "done-when": `${done.filter((d) => d.state === "done").length}/${done.length} done`,
    decisions: `${decs.filter((d) => d.status === "settled").length} settled, ${decs.filter((d) => d.status === "open").length} open, ${decs.filter((d) => d.status === "next").length} next`,
    proofs: `${proofs.filter((c) => c.status === "done").length} proven of ${proofs.length}${proofs.some((c) => c.status === "check") ? `, ${proofs.filter((c) => c.status === "check").length} waiting on the human` : ""}`,
    unread: `${st.unread().length} submission(s) from the human` });
  rows("your-turn", ["id", "phase", "status", "title"], you);
  rows("claude", ["id", "phase", "status", "title", "note"], mine);
  const gaps = KINDS.filter((k) => !proofs.some((c) => JSON.parse(c.body || "{}").kind === k));
  if (gaps.length) say(`proof-gaps: no ${gaps.join(", ")} proof yet`);
  const flat = cards.filter((c) => c.phase === "understand" && c.kind === "note" && !hasDiagram(c.body));
  if (flat.length) say(`diagram-gaps: understand card${flat.length === 1 ? "" : "s"} ${flat.map((c) => c.id).join(", ")} ha${flat.length === 1 ? "s" : "ve"} no diagram`);
  const toDecide = mine.find((c) => c.kind === "question");
  help(flat.length ? `bwm card set ${flat[0].id} --diagram <drawing.svg>` : null, st.unread().length ? "bwm answers" : null, toDecide ? `bwm decide ${toDecide.id} --text "<the decision, one plain sentence>" --why "<why>"` : null, you.length ? "bwm wait" : null,
    mine.find((c) => c.kind !== "question") ? `bwm card set ${mine.find((c) => c.kind !== "question").id} --status done` : null, "bwm render");
}
function cardRow(c) { return { ...c, owner: owner(c.status) }; }
function showCard(st, c, full) {
  const b = c.kind === "note" ? c.body : JSON.parse(c.body || "{}");
  kv({ id: c.id, phase: c.phase, kind: c.kind, title: c.title, status: c.status, owner: owner(c.status), note: c.note, seen: c.status === "done" ? (c.seen_at ? "yes" : "not yet") : undefined });
  if (c.kind === "note" && b) say("text: " + (full ? b : cut(b)));
  if (c.kind === "question") { kv({ topic: b.topic, recommended: b.rec, why: b.why, "flips-if": b.flips }); (b.know ?? []).forEach((k) => say(`know: ${k}`)); rows("options", ["n", "label", "consequence"], (b.options ?? []).map((o, i) => ({ n: i + 1, label: o.split("|")[0], consequence: o.split("|")[1] }))); }
  if (c.kind === "proof") { kv({ "proof-kind": b.kind, claim: b.claim, try: b.try }); (b.setup ?? []).forEach((x) => say(`setup: ${x}`)); rows("steps", ["id", "role", "did", "expected", "got", "evidence"], st.steps(c.id).map((s) => ({ ...s, evidence: s.evidence ?? (s.term ? "(terminal text)" : "") }))); }
}

// ---- main ----
async function main() {
  const argv = process.argv.slice(2), cmd = argv[0];
  if (cmd === "--help" || cmd === "help") {
    say("bwm: keep the build-with-me page, the human's home for this goal. Commands:");
    for (const [k, s] of Object.entries(C)) say(`  ${k.padEnd(9)}${s.args ? s.args + "  " : ""}${s.about.split(". ")[0].replace(/\.$/, "")}`);
    say("Each command takes --help.", `store: ${DIR}`); return;
  }
  if (cmd && !C[cmd]) { const e = new UserError(`unknown command "${cmd}"`, ["bwm --help"]); e.code = 2; throw e; }
  const { f, args } = cmd ? parse(cmd, argv.slice(1)) : { f: {}, args: [] };
  CUR = cmd;
  if (f.help) return cmdHelp(cmd);
  if (!cmd) { if (!fs.existsSync(path.join(DIR, "bwm.db"))) return noStore(); return home(open(DIR)); }
  { // Reject positional words a command doesn't take: one subcommand where it has them, then at most one id.
    const oneId = ["decide", "reask"].includes(cmd), takesSub = ["card", "decision", "proof", "hooks", "shadow"].includes(cmd);
    const max = oneId ? 1 : takesSub ? 2 : 0;
    if (!f.help && args.length > max) throw usage(cmd, `unexpected argument "${args[max]}"`);
  }
  const sub = ["card", "decision", "proof", "hooks"].includes(cmd) || (cmd === "shadow" && args.length) ? args.shift() : null;
  if (["card", "decision", "proof", "hooks"].includes(cmd) || (cmd === "shadow" && sub)) {
    const subs = C[cmd].args.replace(/[[\]]/g, "").split(" | ").map((x) => x.split(" ")[0]);
    if (!subs.includes(sub)) throw usage(cmd, sub ? `unknown subcommand "${sub}"` : `name a subcommand: ${subs.join(", ")}`);
  }

  if (cmd === "card" && sub === "add" && (!f.phase || !f.title)) throw usage("card", "card add needs --phase and --title");
  // Only start makes a store; everything else needs one, so no stray stores appear where bwm is run.
  if (cmd !== "start" && !fs.existsSync(path.join(DIR, "bwm.db")))
    throw new UserError(`no goal yet: no store at ${DIR} or above here`, ['bwm start --title "<few words>" --goal "<one sentence>" --why "<why it matters>" --done "<done when>"']);
  const st = open(DIR);
  switch (cmd) {
    case "start": {
      const g = st.start({ title: f.title, goal: f.goal, why: f.why, ask: f.ask, done: f.done ?? [] });
      say(`started: goal ${g.id}, "${g.title}"`, `store: ${DIR}`);
      return help('bwm card add --phase understand --title "<what the human should know first>" --status done --text-file <brief.md>', 'bwm ask --topic "<topic>" --title "<question>" --option "<label>|<consequence>" --rec 1', "bwm serve");
    }
    case "goal": {
      const g = st.needGoal();
      const states = (f["done-state"] ?? []).map((ds) => {
        const m = ds.match(/^(\d+)=(open|working|done)$/);
        if (!m) throw usage("goal", `--done-state takes <id>=<open|working|done>, got "${ds}"`);
        if (!st.doneWhen().some((d) => d.id === Number(m[1]))) throw new UserError(`no done-when line ${m[1]}`, ["bwm goal"]);
        return [Number(m[1]), m[2]];
      });
      const fields = { title: f.title, goal: f.goal, why: f.why, ask: f.ask, today: f.today, after: f.after, picture: f.picture ? readArg(f.picture) : undefined };
      const changed = st.setGoal(fields);
      for (const t of f["add-done"] ?? []) { st.addDone(t); changed.push("done-when"); }
      for (const [i, state] of states) if (st.markDone(i, state)) changed.push("done-when");
      const asked = Object.values(fields).some((v) => v !== undefined) || states.length || (f["add-done"] ?? []).length;
      if (changed.length) { say(`updated: ${[...new Set(changed)].join(", ")}`); return help("bwm goal", "bwm render"); }
      if (asked) { say("goal: (no-op)"); return; }
      const G = st.goal();
      kv({ title: G.title, goal: G.goal, why: G.why, ask: G.ask, today: JSON.parse(G.today || "[]").join(" | "), after: JSON.parse(G.after || "[]").join(" | "), picture: G.picture ? `${G.picture.length} chars of SVG` : "(none)" });
      rows("done-when", ["id", "state", "text"], st.doneWhen());
      return help("bwm goal --done-state <id>=done", 'bwm goal --ask "<what you need from the human now>"');
    }
    case "card": {
      if (sub === "add") {
        if (!f.phase || !f.title) throw usage("card", `card add needs --phase and --title`);
        const body = withDiagram(f.text ?? readArg(f["text-file"]) ?? null, f.diagram);
        const id = st.addCard({ phase: f.phase, title: f.title, status: f.status ?? "working", note: f.note ?? null, body });
        say(`added: card ${id} (${f.phase}, ${f.status ?? "working"})`);
        if (f.phase === "understand" && !hasDiagram(body)) { say("warning: no diagram. An Understand card opens with a drawing of what it explains."); return help(`bwm card set ${id} --diagram <drawing.svg>`); }
        return help(`bwm card set ${id} --status done`, `bwm card show ${id}`);
      }
      const id = id1(args, "card id"); const c = st.card(id);
      if (sub === "show") return showCard(st, c, f.full);
      if (f.diagram && c.kind !== "note") throw new UserError(`card ${id} is a ${c.kind}; --diagram goes on note cards`);
      const text = f.text ?? readArg(f["text-file"]);
      const changed = st.setCard(id, { status: f.status, note: f.note, title: f.title, phase: f.phase, body: f.diagram ? withDiagram(text ?? c.body, f.diagram) : text });
      say(changed ? `updated: card ${id} → ${f.status ?? c.status}` : `card ${id}: (no-op)`); return help(`bwm card show ${id}`, "bwm");
    }
    case "cards": {
      const all = st.cards({ phase: f.phase, status: f.status, kind: f.kind });
      const list = f.all || f.status === "done" ? all : all.filter((c) => c.status !== "done");
      if (!all.length) { say(`cards: none${f.phase ? ` in ${f.phase}` : ""}`); return help('bwm card add --phase <phase> --title "<title>"'); }
      rows("cards", ["id", "phase", "status", "owner", "title"], list.map(cardRow), all.length);
      if (list.length < all.length) say(`done: ${all.length - list.length} hidden (use --all)`);
      return help(list[0] ? `bwm card show ${list[0].id}` : null, list.length < all.length ? `bwm cards${f.phase ? ` --phase ${f.phase}` : ""} --all` : null);
    }
    case "ask": {
      if (!(f.option ?? []).length) say("note: no --option given; the human answers in their own words");
      for (const o of f.option ?? []) if (!o.includes("|")) throw usage("ask", `--option takes "<label>|<what happens if picked>|<evidence>", got "${o}"`);
      const readFirst = readIds(st, f["read-first"]);
      const id = st.ask({ title: f.title, topic: f.topic, know: f.know ?? [], options: f.option ?? [], rec: f.rec ?? null, why: f.why ?? null, flips: f.flips ?? null, shape: readArg(f["shape-file"]) ?? null, brief: readArg(f["brief-file"]) ?? null, readFirst, phase: f.phase ?? "decide" });
      say(`asked: card ${id}, now in the human's queue`);
      const gaps = askGaps(f, readFirst);
      if (gaps.length) { say(`warning: this question doesn't teach yet: ${gaps.join("; ")}`); return help(`bwm reask ${id} --brief-file <brief.md> --read-first <understand ids> --whats-new "<what's added>"`); }
      return help("bwm wait", 'bwm goal --ask "<what you need from the human now>"');
    }
    case "reask": {
      const id = id1(args, "question card id"), c = st.card(id);
      if (c.kind !== "question") throw new UserError(`card ${id} is a ${c.kind}, not a question`, ["bwm cards --kind question"]);
      for (const o of f.option ?? []) if (!o.includes("|")) throw usage("reask", `--option takes "<label>|<what happens if picked>|<evidence>", got "${o}"`);
      st.reask(id, { whatsNew: f["whats-new"], readFirst: f["read-first"] ? readIds(st, f["read-first"]) : undefined, brief: readArg(f["brief-file"]), know: f.know, options: f.option, rec: f.rec, why: f.why, flips: f.flips });
      say(`asked again: card ${id}, back in the human's queue`);
      return help("bwm wait", `bwm card show ${id}`);
    }
    case "decide": {
      const id = id1(args, "question card id"); const d = st.decide(id, { text: f.text, why: f.why, topic: f.topic, answer: f.answer });
      say(`decided: decision ${d}, card ${id} done`); return help(`bwm decision set ${d} --pin <x>,<y>`, "bwm design");
    }
    case "decision": {
      const pin = f.pin ? f.pin.split(",").map(Number) : null;
      if (pin && (pin.length !== 2 || pin.some((n) => !Number.isFinite(n)))) throw usage("decision", `--pin takes <x>,<y>, got "${f.pin}"`);
      if (sub === "add") {
        if (!f.topic || !f.text) throw usage("decision", "decision add needs --topic and --text");
        const id = st.addDecision({ topic: f.topic, text: f.text, status: f.status ?? "settled", asked: f.asked ?? null, answer: f.answer ?? null, why: f.why ?? null });
        if (pin) st.setDecision(id, { pin_x: pin[0], pin_y: pin[1] });
        say(`added: decision ${id} (${f.status ?? "settled"})`); return help(pin ? null : `bwm decision set ${id} --pin <x>,<y>`, "bwm design");
      }
      const id = id1(args, "decision id");
      const changedD = st.setDecision(id, { topic: f.topic, text: f.text, status: f.status, asked: f.asked, answer: f.answer, why: f.why, ...(pin ? { pin_x: pin[0], pin_y: pin[1] } : {}) });
      say(changedD ? `updated: decision ${id}` : `decision ${id}: (no-op)`); return help("bwm design");
    }
    case "design": {
      const g = st.needGoal();
      kv({ goal: g.goal, why: g.why, ask: g.ask, today: JSON.parse(g.today || "[]").join(" | ") || "(none)", after: JSON.parse(g.after || "[]").join(" | ") || "(none)", picture: g.picture ? "yes" : "(none)" });
      const ds = st.decisions();
      if (!ds.length) say("decisions: none yet");
      else rows("decisions", ["id", "status", "topic", "text", "pinned"], ds.map((d) => ({ ...d, pinned: d.pin_x !== null ? "yes" : "" })));
      const unpinned = g.picture ? ds.filter((d) => d.status !== "next" && d.pin_x === null) : [];
      return help(unpinned.length ? `bwm decision set ${unpinned[0].id} --pin <x>,<y>` : null, !g.today ? 'bwm goal --today "<how it is now>" --after "<how it will be>"' : null, !g.picture ? "bwm goal --picture <after.svg>" : null);
    }
    case "proof": {
      if (sub === "add") {
        if (!f.kind || !f.title) throw usage("proof", "proof add needs --kind and --title");
        const id = st.addProof({ kind: f.kind, title: f.title, claim: f.claim ?? null, setup: f.setup ?? [], planned: !!f.planned });
        say(`added: proof ${id} (${f.kind}${f.planned ? ", planned" : ""})`);
        return help(`bwm proof step ${id} --did "<what you ran>" --expected "<what should happen>" --got "<what did>" --evidence <file>`, `bwm proof control ${id} --did "<a run that should fail>" --expected "<fails>" --got "<what did>"`);
      }
      const id = id1(args, "proof id"); const p = st.proof(id);
      if (sub === "show") return showCard(st, st.card(id), f.full);
      if (sub === "step" || sub === "control") {
        if (!f.did) throw usage("proof", `proof ${sub} needs --did`);
        const term = f.term ?? readArg(f["term-file"]) ?? null;
        const sid = st.addStep(id, { role: sub, did: f.did, expected: f.expected ?? null, got: f.got ?? null, evidence: f.evidence ?? null, term });
        if (p.status === "expected") st.setCard(id, { status: "working", note: "proving" });
        say(`added: ${sub} ${sid} on proof ${id}${f.evidence || term ? "" : " (no evidence attached)"}`);
        const steps = st.steps(id);
        return help(!steps.some((s) => s.role === "control") ? `bwm proof control ${id} --did "<a run that should fail>" --expected "<fails>" --got "<what did>"` : null, `bwm proof pass ${id}`, `bwm proof pass ${id} --check`);
      }
      if (sub === "try") { if (!f.text) throw usage("proof", "proof try needs --text"); st.setProof(id, { try: f.text }); say(`updated: proof ${id} try-it-yourself`); return help(`bwm proof pass ${id}`, `bwm proof show ${id}`); }
      if (sub === "pass") {
        const steps = st.steps(id);
        if (!steps.some((s) => s.role === "step")) throw new UserError(`proof ${id} has no steps yet`, [`bwm proof step ${id} --did "<what you ran>" --expected "<should>" --got "<did>" --evidence <file>`]);
        const changed = st.setCard(id, { status: f.check ? "check" : "done", note: f.check ? "your check" : "proven" });
        say(changed ? `proof ${id}: ${f.check ? "handed to the human to check" : "proven"}` : `proof ${id}: (no-op)`);
        if (!steps.some((s) => s.role === "control")) say("warning: no control run; the human can't see that this test can fail");
        return help(f.check ? "bwm wait" : null);
      }
      if (sub === "fail") { st.setCard(id, { status: "failed", note: f.note ?? "failed" }); say(`proof ${id}: failed`); return help(`bwm proof step ${id} --did "<the re-run>" --expected "<should>" --got "<did>"`); }
      return;
    }
    case "proofs": {
      const ps = st.cards({ kind: "proof" }).map((c) => ({ ...c, kind: JSON.parse(c.body || "{}").kind, steps: st.steps(c.id).length }));
      if (!ps.length) { say("proofs: none yet"); return help('bwm proof add --kind golden --title "<the claim, as the human would check it>"'); }
      rows("proofs", ["id", "kind", "status", "steps", "title"], ps.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)));
      say(`coverage: ${KINDS.map((k) => `${k} ${ps.filter((p) => p.kind === k && p.status === "done").length}/${ps.filter((p) => p.kind === k).length}`).join(", ")}`);
      const gaps = KINDS.filter((k) => !ps.some((p) => p.kind === k)); if (gaps.length) say(`gaps: no ${gaps.join(", ")} proof yet`);
      return;
    }
    case "import": {
      if (!f.reply && !f["reply-file"]) throw usage("import", "pass --reply-file <path> (or --reply <text>)");
      const p = globalThis.BWMReply.parse(f["reply-file"] ? readArg(f["reply-file"]) : f.reply);
      if (!p) throw new UserError("no answers block in the reply: it starts at the line answers[N]{card,question,pick,flags,verdict,note}:", ["bwm import --reply-file <file holding the whole paste>"]);
      if (p.read !== p.expected) throw new UserError(`the reply says ${p.expected} answer(s) but ${p.read} row(s) read; nothing imported. Ask the human to copy the reply again, or check the file holds every row`, ["bwm import --reply-file <file>"]);
      st.submit({ answers: p.answers, seen: p.seen });
    } // falls through: apply it now
    case "answers": case "wait": {
      st.needGoal();
      const deadline = Date.now() + (f.timeout ?? 1800) * 1000;
      let subs = st.unread();
      while (cmd === "wait" && !subs.length && Date.now() < deadline) { await new Promise((r) => setTimeout(r, 1000)); subs = st.unread(); }
      if (!subs.length) { say(cmd === "wait" ? `answers: none within ${f.timeout ?? 1800} s` : "answers: none unread"); return help(cmd === "wait" ? "bwm wait" : null); }
      const lines = subs.flatMap((s) => st.apply(s));
      rows("answers", ["card", "title", "answer"], lines);
      const qs = lines.filter((l) => typeof l.card === "number" && st.card(l.card).kind === "question" && l.flags && !l.flags.length);
      return help(qs.map((l) => `bwm decide ${l.card} --text "<the decision, one plain sentence>" --why "<why>"`).slice(0, 3), "bwm");
    }
    case "serve": {
      st.needGoal();
      const { serve } = await import("./lib/server.mjs");
      const port = f.port ?? Number(process.env.BWM_PORT ?? 4848);
      const srv = await serve(st, { port, page: path.join(TOOL, "page") }).catch((e) => { throw e.port ? new UserError(`port ${port} is in use (another bwm serve, or something else)`, [`bwm serve --port ${port + 1}`]) : e; });
      console.log(`serving: ${srv.url}\nstore: ${DIR}\nhelp[1]:\n  ${BWM} wait`);
      return new Promise(() => {}); // runs until killed
    }
    case "render": {
      st.needGoal();
      const { render } = await import("./lib/render.mjs");
      const file = path.resolve(f.out ?? path.join(DIR, "page.html"));
      const r = render(st, path.join(TOOL, "page"), file);
      say(`rendered: ${file}`, `size: ${r.bytes} bytes${r.skipped.length ? `; ${r.skipped.length} evidence file(s) over the inline limit linked by path` : ""}`);
      return help(`bwm check`);
    }
    case "hooks": {
      const I = await import("./lib/install.mjs");
      const hookPath = path.join(TOOL, "hooks", "hook.mjs");
      const file = path.resolve(f.settings ?? path.join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), ".claude", "settings.local.json"));
      if (sub === "install") {
        const mode = f.mode ?? "shadow";
        if (!["shadow", "live"].includes(mode)) throw usage("hooks", `--mode takes shadow or live, got "${mode}"`);
        const r = I.install(file, hookPath, mode);
        st.setting("hooks.mode", mode); if (r.addedEnv) st.setting("hooks.addedEnv", "1");
        say(`installed: ${r.events.length} hooks in ${file}`, `mode: ${mode}${mode === "shadow" ? " (the classifier records what it would ask for; nothing is injected)" : " (page updates arrive as hook messages)"}`,
          "task-sync: on (TaskCreate, TaskUpdate, TodoWrite land on the board as your cards)", "takes-effect: next session, or after /hooks reload");
        return help(mode === "shadow" ? "bwm shadow" : null, "bwm hooks status");
      }
      if (sub === "uninstall") {
        const n = I.uninstall(file, hookPath, st.setting("hooks.addedEnv") === "1");
        st.setting("hooks.mode", "off");
        say(n ? `removed: ${n} hooks from ${file}` : `hooks: (no-op) none in ${file}`); return help("bwm hooks status");
      }
      const list = I.status(file, hookPath);
      kv({ settings: file, mode: list.length ? st.setting("hooks.mode") ?? "shadow" : "not installed" });
      rows("hooks", ["event", "matcher", "async"], list);
      return help(list.length ? null : "bwm hooks install");
    }
    case "shadow": {
      if (sub === "show") {
        const r = st.shadowRow(id1(args, "shadow moment id"));
        kv({ id: r.id, when: new Date(r.ts).toISOString(), event: r.event, label: r.label ?? "(not yet)", should: r.should, note: r.note, "you-did": r.agent_did, error: r.meta?.error, ms: r.meta?.ms });
        rows("would-ask", ["type", "target", "confidence", "reason"], r.actions);
        if (r.moment) { kv({ human: cut(r.moment.user, 600), claude: cut(r.moment.assistant, 600) }); rows("tools", ["name", "input", "result"], r.moment.tools ?? []); }
        return help(`bwm shadow label ${r.id} --label right`, `bwm shadow label ${r.id} --label wrong --note "<why>"`, `bwm shadow label ${r.id} --label missed --should "<types that were due>"`);
      }
      if (sub === "label") {
        const id = id1(args, "shadow moment id");
        if (!f.label) throw usage("shadow", "missing --label");
        st.labelShadow(id, { label: f.label, should: f.should, note: f.note });
        say(`labelled: moment ${id} ${f.label}`); return help("bwm shadow");
      }
      const all = st.shadow({ limit: 100000 }), list = st.shadow({ unlabelled: !f.all, limit: f.limit ?? 30 });
      const L = (k) => all.filter((r) => r.label === k).length;
      kv({ moments: all.length, asked: all.filter((r) => r.actions.length).length, "you-acted-alone": all.filter((r) => r.agent_did && !r.actions.length).length,
        labelled: `${L("right")} right, ${L("wrong")} wrong, ${L("missed")} missed`, errors: all.filter((r) => r.meta?.error).length || undefined });
      rows(f.all ? "moments" : "unlabelled", f.all ? ["id", "event", "label", "would", "you_did"] : ["id", "event", "would", "you_did"], list.map((r) => ({ ...r, would: r.actions.map((a) => a.type).join(" ") || "-", you_did: r.agent_did ?? "" })), f.all ? all.length : all.filter((r) => !r.label).length);
      return help(list[0] ? `bwm shadow show ${list[0].id}` : null);
    }
    case "check": {
      st.needGoal();
      const { check } = await import("./lib/check.mjs");
      const r = await check(st, { tool: TOOL, dir: DIR, url: f.url });
      rows("shots", ["view", "path"], r.shots);
      if (r.faults.length) rows("faults", ["view", "fault"], r.faults); else say(`faults: none at ${r.shots.length} views`);
      say("next: read each screenshot, fix what looks wrong, then run check again");
      return help(f.url ? `bwm check --url ${f.url}` : "bwm check");
    }
  }
}

main().then(() => flush(0)).catch((e) => {
  if (e instanceof UserError) {
    say(`error: ${e.message}`);
    if (e.usage) { say(""); cmdHelp(e.usage); return flush(2); }
    help(e.help ?? []); return flush(e.code ?? 1);
  }
  say(`error: ${e.message}`); console.error(e.stack); flush(1);
});
