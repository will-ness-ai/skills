// doctor: one line for each thing the service needs, and whether it is there.
import { spawnSync } from "node:child_process";
import { HOME, LIBRARY } from "./db.mjs";
import { label, which } from "./install.mjs";

// needed: without it no lesson gets made. The rest is state worth seeing.
export async function checks(q, { port = 4747 } = {}) {
  const claude = which("claude"), ffmpeg = which("ffmpeg"), worker = q.alive("worker");
  const out = [
    { name: "node", needed: true, ok: true, detail: process.version },
    { name: "claude", needed: true, ok: Boolean(claude), detail: claude ?? "not on PATH; install Claude Code" },
    { name: "ffmpeg", needed: true, ok: Boolean(ffmpeg), detail: ffmpeg ?? "not on PATH; brew install ffmpeg" },
    { name: "home", needed: true, ok: true, detail: `${HOME} (library: ${LIBRARY})` },
    // The worker's own pulse, so a job that is loaded but crashing shows as not running.
    { name: "worker", needed: false, ok: Boolean(worker), detail: worker ? `running (pid ${worker.pid})` : "not running; start it with `lessons work` or `lessons install`" },
  ];
  if (process.platform === "darwin") for (const name of ["site", "worker"]) {
    const ok = spawnSync("launchctl", ["print", `gui/${process.getuid()}/${label(name)}`], { stdio: "ignore" }).status === 0;
    out.push({ name: `${name} job`, needed: false, ok, detail: ok ? `${label(name)} is loaded` : "not loaded; run `lessons install`" });
  }
  const site = await fetch(`http://127.0.0.1:${port}/api/courses`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
  out.push({ name: "site", needed: false, ok: site, detail: site ? `http://localhost:${port}` : `nothing answers on port ${port}; run \`lessons serve\` or \`lessons install\`` });
  return out;
}

// True when a queued request would get made: the tools are there. What is not running is shown, not failed.
export async function doctor(q, opts) {
  const all = await checks(q, opts);
  for (const c of all) console.log(`${c.ok ? "ok  " : c.needed ? "FAIL" : "--  "}  ${c.name.padEnd(11)}${c.detail}`);
  return all.every((c) => c.ok || !c.needed);
}
