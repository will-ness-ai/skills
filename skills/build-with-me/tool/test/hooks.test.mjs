// The page hooks: task sync, shadow logging, live messages, install and uninstall. No model calls:
// the classifier runs on the Jev backend with no key, which fails open with no actions.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "bwm-hooks-"));
const env = { ...process.env, CLAUDE_PROJECT_DIR: proj, BWM_CMD: "bwm", BWM_BACKEND: "jev", TYPESAFE_API_KEY: "", BWM_MIN_GAP_MS: "0" };
delete env.BWM_DIR; delete env.BWM_HOOKS_MODE;
const bwm = (...a) => spawnSync(process.execPath, [path.join(TOOL, "bwm.mjs"), ...a], { encoding: "utf8", env, cwd: proj });
const hook = (input, extra = {}) => spawnSync(process.execPath, [path.join(TOOL, "hooks", "hook.mjs")], { input: JSON.stringify(input), encoding: "utf8", env: { ...env, ...extra } });
const { open } = await import("../lib/store.mjs");

test("the hooks do nothing in a project with no page, and create no store", () => {
  const r = hook({ hook_event_name: "PostToolUse", session_id: "s", tool_name: "TaskCreate", tool_input: { subject: "x" }, tool_response: { task: { id: "1" } } });
  assert.equal(r.status, 0); assert.equal(r.stdout, "");
  assert.equal(fs.existsSync(path.join(proj, ".build-with-me")), false);
});

test("install writes every hook once, in shadow mode by default, and uninstall takes them out", () => {
  assert.equal(bwm("start", "--title", "T", "--goal", "G", "--done", "d").status, 0);
  const file = path.join(proj, ".claude", "settings.local.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }));
  let r = bwm("hooks", "install"); assert.equal(r.status, 0); assert.match(r.stdout, /mode: shadow/);
  bwm("hooks", "install"); // twice is the same as once
  let s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(s.hooks.Stop.length, 2, "keeps the human's own Stop hook and adds one");
  assert.equal(s.hooks.UserPromptSubmit[0].hooks[0].async, true, "shadow mode never makes the human wait");
  assert.equal(s.hooks.PostToolUse[0].matcher, "TaskCreate|TaskUpdate|TodoWrite");
  assert.equal(s.env.CLAUDE_CODE_ENABLE_TODO_TOOLS, "1");
  r = bwm("hooks", "status"); assert.match(r.stdout, /hooks\[5\]/);
  bwm("hooks", "install", "--mode", "live");
  s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(s.hooks.UserPromptSubmit[0].hooks[0].async, undefined, "live mode waits for the classifier");
  r = bwm("hooks", "uninstall"); assert.match(r.stdout, /removed: 5 hooks/);
  s = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(s, { permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } });
  assert.equal(bwm("hooks", "install", "--mode", "loud").status, 2);
  bwm("hooks", "install");
});

test("the native task list lands on the board as Claude's cards", () => {
  const T = (tool_name, tool_input, tool_response = {}) => hook({ hook_event_name: "PostToolUse", session_id: "s1", tool_name, tool_input, tool_response });
  T("TaskCreate", { subject: "Wire the login check" }, { task: { id: "1", subject: "Wire the login check" } });
  T("TaskUpdate", { taskId: "1", status: "in_progress" });
  T("TodoWrite", { todos: [{ content: "Read the server", status: "completed" }, { content: "Add the test", status: "pending" }, { content: "Maybe later", status: "pending" }] });
  T("TodoWrite", { todos: [{ content: "Add the test", status: "in_progress" }] });
  const cards = open(path.join(proj, ".build-with-me")).cards();
  const by = Object.fromEntries(cards.map((c) => [c.title, c.status]));
  assert.deepEqual(by, { "Wire the login check": "working", "Read the server": "done", "Add the test": "working" }, "a dropped unfinished item leaves; a finished one stays done");
  T("TaskUpdate", { taskId: "1", status: "deleted" });
  assert.equal(open(path.join(proj, ".build-with-me")).cards().some((c) => c.title === "Wire the login check"), false);
});

test("shadow mode records moments and the agent's own page work, and injects nothing", () => {
  let r = hook({ hook_event_name: "SessionStart", session_id: "s1" });
  assert.equal(r.stdout, "", "no SessionStart text in shadow mode");
  r = hook({ hook_event_name: "PostToolBatch", session_id: "s1", tool_calls: [{ tool_name: "Bash", tool_input: { command: "npm test" }, tool_response: "12 passing" }] });
  assert.equal(r.stdout, "");
  hook({ hook_event_name: "PostToolBatch", session_id: "s1", tool_calls: [{ tool_name: "Bash", tool_input: { command: "node /x/build-with-me/tool/bwm.mjs card set 1 --status done" }, tool_response: "ok" }] });
  hook({ hook_event_name: "PostToolBatch", session_id: "s1", tool_calls: [{ tool_name: "Read", tool_input: { file_path: "a" }, tool_response: "" }] });
  r = bwm("shadow");
  assert.match(r.stdout, /^moments: 2$/m, "the read-only batch is skipped");
  assert.match(r.stdout, /you-acted-alone: 1/);
  assert.match(r.stdout, /bwm card set 1 --status done/);
  const id = r.stdout.match(/unlabelled\[\d+\]\{[^}]+\}:\n {2}(\d+)/)[1];
  assert.equal(bwm("shadow", "label", id, "--label", "missed", "--should", "proof.attach").status, 0);
  assert.match(bwm("shadow", "--all").stdout, /0 right, 0 wrong, 1 missed/);
  assert.equal(bwm("shadow", "label", id, "--label", "meh").status, 1);
});

test("live mode tells the agent at session start and names the bwm command for each action", async () => {
  const r = hook({ hook_event_name: "SessionStart", session_id: "s3" }, { BWM_HOOKS_MODE: "live" });
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /build-with-me page:/);
  const { message } = await import("../hooks/hook.mjs");
  const m = message([{ type: "proof.attach", target: "9", reason: "the curl run proves it" }], "Stop");
  assert.match(m, /^build-with-me page: your reply is sent/);
  assert.match(m, /bwm\.mjs proof step <id> --did/);
});
