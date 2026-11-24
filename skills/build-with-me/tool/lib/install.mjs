// Writes the build-with-me hooks into a Claude Code settings file, and takes them out again.
// Every entry it writes runs hooks/hook.mjs, which is how it finds its own entries later.
import fs from "node:fs";
import path from "node:path";

const TASK_TOOLS = "TaskCreate|TaskUpdate|TodoWrite";

export function entries(hookPath, mode) {
  const cmd = { type: "command", command: `node "${hookPath}"` };
  // Shadow mode injects nothing, so every classifier hook runs in the background and adds no wait.
  const bg = mode === "live" ? {} : { async: true };
  return {
    SessionStart: [{ hooks: [{ ...cmd, timeout: 10 }] }],
    UserPromptSubmit: [{ hooks: [{ ...cmd, timeout: 15, ...bg }] }],
    PostToolBatch: [{ hooks: [{ ...cmd, timeout: 15, async: true }] }],
    PostToolUse: [{ matcher: TASK_TOOLS, hooks: [{ ...cmd, timeout: 10 }] }],
    Stop: [{ hooks: [{ ...cmd, timeout: 15, ...bg }] }],
  };
}

const ours = (group, hookPath) => (group.hooks ?? []).some((h) => String(h.command ?? "").includes(hookPath));
const read = (file) => { if (!fs.existsSync(file)) return {}; try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { throw new Error(`${file} is not valid JSON; fix it by hand first`); } };
const write = (file, s) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n"); };

export function strip(s, hookPath) {
  let removed = 0;
  for (const ev of Object.keys(s.hooks ?? {})) {
    const before = s.hooks[ev].length;
    s.hooks[ev] = s.hooks[ev].filter((g) => !ours(g, hookPath));
    removed += before - s.hooks[ev].length;
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  return removed;
}

export function install(file, hookPath, mode) {
  const s = read(file);
  strip(s, hookPath);
  s.hooks ??= {};
  for (const [ev, groups] of Object.entries(entries(hookPath, mode))) (s.hooks[ev] ??= []).push(...groups);
  // The native task tools are off by default on newer models; task sync needs them on.
  const addedEnv = s.env?.CLAUDE_CODE_ENABLE_TODO_TOOLS === undefined;
  s.env = { ...(s.env ?? {}), CLAUDE_CODE_ENABLE_TODO_TOOLS: s.env?.CLAUDE_CODE_ENABLE_TODO_TOOLS ?? "1" };
  write(file, s);
  return { events: Object.keys(entries(hookPath, mode)), addedEnv };
}

export function uninstall(file, hookPath, dropEnv) {
  if (!fs.existsSync(file)) return 0;
  const s = read(file), removed = strip(s, hookPath);
  if (dropEnv && s.env) { delete s.env.CLAUDE_CODE_ENABLE_TODO_TOOLS; if (!Object.keys(s.env).length) delete s.env; }
  write(file, s);
  return removed;
}

export function status(file, hookPath) {
  const s = fs.existsSync(file) ? read(file) : {};
  return Object.entries(s.hooks ?? {}).filter(([, gs]) => gs.some((g) => ours(g, hookPath))).map(([ev, gs]) => {
    const h = gs.find((g) => ours(g, hookPath)).hooks.find((x) => String(x.command).includes(hookPath));
    return { event: ev, matcher: gs.find((g) => ours(g, hookPath)).matcher ?? "", async: h.async ? "yes" : "no" };
  });
}
