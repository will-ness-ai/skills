// The worker: pops one request at a time and hands it to a headless Claude Code
// agent. The agent's stream is written to the events table as it arrives, so the
// site shows what the agent is saying and doing, live.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOME, LIBRARY } from "./db.mjs";

const SERVICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(SERVICE, "..");
const CLI = path.join(SERVICE, "bin/lessons.mjs");

export const config = () => {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(path.join(HOME, "config.json"), "utf8")); } catch {}
  return {
    // The agent runs unattended, so every tool it needs must be allowed up front.
    agent: ["claude", "-p", "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits",
      "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Agent,Task"],
    voiceFlags: [],
    pollSeconds: 5,
    maxMinutes: 60, // a request still running after this is stopped and failed
    ...file,
  };
};

export function prompt(r, cfg = config()) {
  return fs.readFileSync(path.join(SERVICE, "WORKER.md"), "utf8")
    .replaceAll("{{id}}", String(r.id))
    .replaceAll("{{request}}", r.request)
    .replaceAll("{{transcript_path}}", r.transcript_path ?? "(none given)")
    .replaceAll("{{message_id}}", r.message_id ?? "(none given)")
    .replaceAll("{{cwd}}", r.cwd ?? "(unknown)")
    .replaceAll("{{course_hint}}", r.course ?? "(none: you decide)")
    .replaceAll("{{library}}", LIBRARY)
    .replaceAll("{{skill}}", SKILL)
    .replaceAll("{{lessons}}", `node ${CLI}`)
    .replaceAll("{{voice_flags}}", cfg.voiceFlags.join(" ") || "(none: the engine's default voice)");
}

const short = (v, n = 160) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// One line per tool call: the part of its input a person would recognise.
const toolLine = (name, input = {}) => `${name} ${short(input.command ?? input.file_path ?? input.pattern ?? input.url ?? input.query ?? input.description ?? input.prompt ?? input)}`;

// Turns one line of `claude -p --output-format stream-json` into events.
export function record(q, id, line) {
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (m.type === "system" && m.subtype === "init" && m.session_id) q.session(id, m.session_id);
  if (m.type === "assistant" && !m.parent_tool_use_id) {
    for (const b of m.message?.content ?? []) {
      if (b.type === "text" && b.text.trim()) q.log(id, "say", b.text.trim());
      if (b.type === "tool_use") q.log(id, "tool", toolLine(b.name, b.input));
    }
  }
  if (m.type === "result") return m;
}

export function run(q, r, cfg = config()) {
  return new Promise((resolve) => {
    const [cmd, ...args] = cfg.agent;
    fs.mkdirSync(path.join(HOME, "logs"), { recursive: true });
    const raw = fs.createWriteStream(path.join(HOME, "logs", `request-${r.id}.jsonl`), { flags: "a" });
    const dirs = ["--add-dir", SKILL, ...(r.transcript_path && fs.existsSync(r.transcript_path) ? ["--add-dir", path.dirname(r.transcript_path)] : [])];
    // The prompt goes in on stdin: claude's --add-dir and --allowedTools take every argument after them.
    const child = spawn(cmd, [...args, ...(cmd === "claude" ? dirs : [])], { cwd: LIBRARY, env: { ...process.env, LESSONS_REQUEST: String(r.id) }, stdio: ["pipe", "pipe", "pipe"], detached: true });
    // Its own process group, so stopping it also stops the builds and subagents it started.
    const stop = (signal) => { try { process.kill(-child.pid, signal); } catch {} };
    let late = false;
    const limit = setTimeout(() => { late = true; stop("SIGTERM"); setTimeout(() => stop("SIGKILL"), 5000).unref(); }, cfg.maxMinutes * 60_000);
    child.stdin.on("error", () => {}); // an agent that never reads its prompt
    child.stdin.end(prompt(r, cfg));
    let buf = "", result = null, err = "";
    child.stdout.on("data", (d) => {
      raw.write(d);
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { result = record(q, r.id, buf.slice(0, i)) ?? result; buf = buf.slice(i + 1); }
    });
    child.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
    child.on("error", (e) => { clearTimeout(limit); q.finish(r.id, "failed", `could not start the agent (${cmd}): ${e.message}`); resolve(); });
    child.on("close", (code) => {
      clearTimeout(limit);
      raw.end();
      // The agent closes its own request with `lessons done`. One still open is a failure.
      if (q.get(r.id).status === "working") q.finish(r.id, "failed", late ? `stopped after ${cfg.maxMinutes} minutes (maxMinutes in config.json). \`lessons requeue ${r.id}\` tries again` : code === 0 ? "the agent stopped without finishing the request" : `the agent exited with code ${code}: ${short(err.trim() || result?.result || "no output", 400)}`);
      resolve();
    });
  });
}

export async function work(q, { once = false, log = console.log } = {}) {
  const name = `${os.hostname()}:worker`;
  q.recover(name);
  for (;;) {
    const cfg = config();
    const r = q.claim(name);
    if (r) { log(`request ${r.id}: ${short(r.request, 80)}`); await run(q, r, cfg); log(`request ${r.id}: ${q.get(r.id).status}`); }
    else if (once) return;
    else await new Promise((res) => setTimeout(res, cfg.pollSeconds * 1000));
    if (once && !q.list("queued").length) return;
  }
}
