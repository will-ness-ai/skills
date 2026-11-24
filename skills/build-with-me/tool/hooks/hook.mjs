#!/usr/bin/env node
// The build-with-me hooks: one entry point for every hook event, installed by `bwm hooks install`.
//
//   SessionStart       live mode: tells the agent page upkeep comes from hook messages
//   PostToolUse        on TaskCreate, TaskUpdate and TodoWrite: mirrors the native task list onto
//                      Claude's board cards (no model call; live in both modes)
//   UserPromptSubmit,  a classifier reads the new moment and names the page actions now due.
//   PostToolBatch,     shadow mode (the default) records them in the store for `bwm shadow` and
//   Stop               injects nothing; live mode hands them to the agent as a hook message.
//
// Fails open everywhere: any error, timeout or odd input exits 0 with no output.
// It acts only in a project whose .build-with-me/bwm.db exists, and never creates one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const quiet = () => process.exit(0);
const out = (obj) => { process.stdout.write(JSON.stringify(obj)); process.exit(0); };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BWM = `node ${path.join(path.dirname(HERE), "bwm.mjs")}`;

export const SESSION_START_LIVE = `This session keeps a build-with-me page for the human. In this session, page upkeep comes from hooks.
- A classifier reads each human message, each batch of tool calls and each reply. When the page needs something, a hook message starting "build-with-me page:" names it and gives the bwm command.
- Run bwm page commands in response to those messages, for the actions they name, with your own wording and targets. Between them, work and chat as usual; the classifier catches finished steps and stale cards.
- Your native task list (TaskCreate/TaskUpdate or TodoWrite) is mirrored onto the board for you. Use it as you normally would.
- When a message arrives, finish the step you are in, then make the page call. If the action no longer fits, skip it and say so in one short line.`;

// What each action asks the agent to run. Live mode puts these in the hook message.
const HOW = {
  "board.add_card": `${BWM} card add --phase <phase> --title "<title>" --status <status>`,
  "board.move_card": `${BWM} card set <id> --status <status> --note "<short note>"`,
  "design.update": `${BWM} goal --ask "<…>"  or  ${BWM} decision add --topic "<…>" --text "<one plain sentence>"`,
  "proof.build": `${BWM} proof add --kind golden|edge|error|hardening --title "<the claim>", then capture the run`,
  "proof.attach": `${BWM} proof step <id> --did "<…>" --expected "<…>" --got "<…>" --evidence <file>`,
  "ask.queue": `${BWM} ask --topic "<…>" --title "<question>" --option "<label>|<what happens>" --rec 1`,
};

export function message(actions, event) {
  const lead = event === "Stop"
    ? "build-with-me page: your reply is sent, and these page updates are now due. Run them, then stop without repeating the reply."
    : "build-with-me page: these page updates are due. Run them after the step you are in.";
  return [lead, ...actions.map((a) => `- ${a.type}${a.target ? ` (${a.target})` : ""}: ${a.reason}\n  ${HOW[a.type]}`)].join("\n");
}

// A compact page summary for the classifier, so its input stays small.
export function summarise(st) {
  const s = st.state();
  if (!s) return "GOAL: (not set)\nBOARD: (empty)";
  const linked = new Set(st.db.prepare("SELECT card_id FROM task_links").all().map((r) => r.card_id));
  const by = (k) => s.decisions.filter((d) => d.status === k).map((d) => d.text).join("; ") || "none";
  return [
    `GOAL: ${s.goal.goal}`,
    `ASK: ${s.goal.ask || "(none)"}`,
    `DONE-WHEN: ${s.done.map((d) => `${d.text} [${d.state}]`).join("; ") || "(none)"}`,
    `DECISIONS settled: ${by("settled")} | open: ${by("open")} | next: ${by("next")}`,
    `BOARD (cards marked [task list] follow Claude's own task list automatically; never ask to move them):\n${s.cards.filter((c) => c.status !== "done").map((c) => ` ${c.id} ${c.phase} ${c.kind} ${c.status} "${c.title}"${linked.has(c.id) ? " [task list]" : ""}`).join("\n") || " (all done)"}`,
    `PROOFS: ${s.cards.filter((c) => c.kind === "proof").map((c) => `${c.id} ${c.body?.kind} ${c.status} steps=${c.steps?.length ?? 0}`).join(", ") || "(none)"}`,
  ].join("\n");
}

// ---- native task list -> Claude's board cards ----
const TASK_STATUS = { pending: "expected", in_progress: "working", completed: "done" };
export function syncTasks(st, h) {
  if (!st.goal()) return [];
  const sid = h.session_id || "session", ti = h.tool_input || {}, tr = h.tool_response || {};
  const ops = [];
  const upsert = (task, { title, status }) => {
    const id = st.taskCard(sid, task);
    let card = null; try { card = id ? st.card(id) : null; } catch {}
    if (card) { if (st.setCard(card.id, { title, status })) ops.push(`updated card ${card.id}`); return; }
    if (!title) return;
    const nid = st.addCard({ phase: "prove", title, status: status ?? "expected", note: "on Claude's list" });
    st.taskCard(sid, task, nid); ops.push(`added card ${nid}`);
  };
  // A finished item stays on the board as done; anything else that leaves the list leaves the board.
  const drop = (task) => {
    const id = st.taskCard(sid, task); if (!id) return;
    let c = null; try { c = st.card(id); } catch {}
    if (c && c.status !== "done") { st.removeCard(id); ops.push(`removed card ${id}`); }
    st.taskCard(sid, task, null);
  };
  if (h.tool_name === "TaskCreate") {
    const t = tr.task || {};
    const id = t.id ?? tr.taskId ?? tr.id;
    if (id !== undefined) upsert(id, { title: t.subject || ti.subject, status: TASK_STATUS[t.status] ?? "expected" });
  } else if (h.tool_name === "TaskUpdate") {
    const id = ti.taskId ?? tr.taskId;
    if (id === undefined) return ops;
    if (ti.status === "deleted") drop(id);
    else upsert(id, { title: ti.subject, status: TASK_STATUS[ti.status] });
  } else if (h.tool_name === "TodoWrite") {
    // TodoWrite sends the whole list each time; items are matched by their text.
    const todos = ti.todos || [], keep = new Set();
    for (const t of todos) { const k = `todo:${t.content}`; keep.add(k); upsert(k, { title: t.content, status: TASK_STATUS[t.status] ?? "expected" }); }
    for (const l of st.taskLinks(sid)) if (l.task.startsWith("todo:") && !keep.has(l.task)) drop(l.task);
  }
  if (ops.length) st.log(`Claude's list: ${ops.length} change${ops.length === 1 ? "" : "s"}`);
  return ops;
}

// ---- gating, so the classifier runs only on moments that could matter ----
const READ_ONLY = /^(Read|Grep|Glob|LS|ToolSearch|WebSearch|WebFetch|TaskList|TaskGet)$/;
const TASK = /^(TaskCreate|TaskUpdate|TaskList|TaskGet|TodoWrite|update_plan)$/;

async function main() {
  if (process.env.BWM_CLASSIFIER_CHILD === "1") quiet();
  let raw = ""; for await (const c of process.stdin) raw += c;
  let h; try { h = JSON.parse(raw); } catch { quiet(); }
  const dir = process.env.BWM_DIR ? path.resolve(process.env.BWM_DIR) : path.join(process.env.CLAUDE_PROJECT_DIR || h.cwd || process.cwd(), ".build-with-me");
  if (!fs.existsSync(path.join(dir, "bwm.db"))) quiet();
  const { open } = await import("../lib/store.mjs");
  const st = open(dir);
  const mode = process.env.BWM_HOOKS_MODE || st.setting("hooks.mode") || "shadow";
  const event = h.hook_event_name;

  if (event === "SessionStart") { if (mode === "live") out({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: SESSION_START_LIVE } }); quiet(); }
  if (event === "PostToolUse" && TASK.test(h.tool_name || "")) { syncTasks(st, h); quiet(); }
  if (!["UserPromptSubmit", "PostToolBatch", "PostToolUse", "Stop"].includes(event)) quiet();

  const { readTail, buildWindow, PAGE_TOOL_RE } = await import("./transcript.mjs");
  const key = `hooks.state.${h.session_id || "x"}`;
  let hs; try { hs = JSON.parse(st.setting(key) || "{}"); } catch { hs = {}; }
  const save = () => st.setting(key, JSON.stringify(hs));
  const now = Date.now();
  let fresh = null, agentDid = null;

  if (event === "PostToolBatch" || event === "PostToolUse") {
    let calls = event === "PostToolBatch" ? (h.tool_calls || []) : [{ tool_name: h.tool_name, tool_input: h.tool_input, tool_response: h.tool_response }];
    const isPage = (c) => PAGE_TOOL_RE.test(c.tool_name || "") || (c.tool_name === "Bash" && PAGE_TOOL_RE.test(String(c.tool_input?.command || "")));
    const page = calls.filter(isPage);
    if (page.length) {
      hs.pageAt = now; hs.pending = []; save();
      agentDid = page.map((c) => String(c.tool_input?.command || c.tool_name).replace(/\s+/g, " ").replace(/^node \S*bwm\.mjs/, "bwm").slice(0, 160)).join(" ;; ");
    }
    // Shadow mode keeps the page work the agent chose to do on its own, for labelling.
    const skip = (why) => { if (agentDid && mode !== "live") st.addShadow({ session: h.session_id, event, actions: [], agent_did: agentDid, meta: { skip: why } }); quiet(); };
    calls = calls.filter((c) => !isPage(c) && !TASK.test(c.tool_name || ""));
    if (!calls.length || calls.every((c) => READ_ONLY.test(c.tool_name || ""))) skip("no other work in the batch");
    if (now - (hs.lastAt || 0) < Number(process.env.BWM_MIN_GAP_MS ?? 20000)) skip("classifier ran less than 20 s ago");
    if (hs.runningSince && now - hs.runningSince < 20000) skip("classifier already running"); // async hooks can overlap
    const clip = (v, n) => String(typeof v === "string" ? v : JSON.stringify(v ?? "")).replace(/\s+/g, " ").slice(0, n);
    fresh = calls.map((c) => ({ name: c.tool_name, input: clip(c.tool_input, 160), result: clip(c.tool_response, 200) }));
  }
  if (event === "Stop" && h.stop_hook_active && hs.blockedStopAt && now - hs.blockedStopAt < 600_000) quiet();

  const w = buildWindow(readTail(h.transcript_path));
  if (event === "UserPromptSubmit") w.user = String(h.prompt || "").slice(0, 1200);
  if (event === "Stop" && h.last_assistant_message) w.assistant = String(h.last_assistant_message).slice(0, 1200);
  if (fresh) w.tools = fresh;
  if (hs.pageAt && now - hs.pageAt < 60_000) w.sinceLastPageCall = 0;

  hs.lastAt = now; hs.runningSince = now; save();
  const { classify } = await import("./classify.mjs");
  const res = await classify({ window: w, state: summarise(st), event });

  // Dedupe: a type asked for and not yet acted on is not asked again for 3 minutes.
  try { hs = { ...hs, ...JSON.parse(st.setting(key) || "{}") }; } catch {}
  hs.runningSince = 0;
  hs.pending = (hs.pending || []).filter((r) => now - r.at < 180_000);
  const due = res.actions.filter((a) => !hs.pending.some((r) => r.type === a.type));
  if (mode === "live") { for (const a of due) hs.pending.push({ type: a.type, at: now }); if (due.length && event === "Stop") hs.blockedStopAt = now; }
  save();

  if (mode !== "live") {
    st.addShadow({ session: h.session_id, event, moment: w, actions: res.actions, agent_did: agentDid, meta: res.meta });
    quiet();
  }
  if (!due.length) quiet();
  out({ hookSpecificOutput: { hookEventName: event, additionalContext: message(due, event) } });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(() => quiet());
