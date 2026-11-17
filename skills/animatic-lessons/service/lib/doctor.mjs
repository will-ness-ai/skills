// doctor: one line for each thing the service needs, and whether it is there.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { HOME, LIBRARY } from "./db.mjs";
import { label, nodeOk, which } from "./install.mjs";

// needed: without it no lesson gets made. The rest is state worth seeing.
export async function checks({ port = 4747 } = {}) {
  const claude = which("claude"), ffmpeg = which("ffmpeg");
  const out = [
    { name: "node", needed: true, ok: nodeOk(), detail: nodeOk() ? process.version : `${process.version}; the queue needs 22.5 or later` },
    { name: "claude", needed: true, ok: Boolean(claude), detail: claude ?? "not on PATH; install Claude Code" },
    { name: "ffmpeg", needed: true, ok: Boolean(ffmpeg), detail: ffmpeg ?? "not on PATH; brew install ffmpeg" },
    { name: "home", needed: false, ok: fs.existsSync(HOME), detail: `${HOME} (library: ${LIBRARY})` },
  ];
  if (process.platform === "darwin") for (const name of ["site", "worker"]) {
    const ok = spawnSync("launchctl", ["print", `gui/${process.getuid()}/${label(name)}`], { stdio: "ignore" }).status === 0;
    out.push({ name: `${name} job`, needed: false, ok, detail: ok ? `${label(name)} is loaded` : "not loaded; run `lessons install`" });
  }
  const site = await fetch(`http://127.0.0.1:${port}/api/courses`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false);
  out.push({ name: "site", needed: false, ok: site, detail: site ? `http://localhost:${port}` : `nothing answers on port ${port}; run \`lessons serve\` or \`lessons install\`` });
  return out;
}

export async function doctor(opts) {
  const all = await checks(opts);
  for (const c of all) console.log(`${c.ok ? "ok  " : c.needed ? "FAIL" : "--  "}  ${c.name.padEnd(11)}${c.detail}`);
  return all.every((c) => c.ok || !c.needed);
}
