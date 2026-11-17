// macOS: keep the site and the worker running as launchd agents, and put
// `lessons` on PATH. Both agents start at login and restart if they stop.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HOME } from "./db.mjs";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../bin/lessons.mjs");
const AGENTS = path.join(os.homedir(), "Library/LaunchAgents");
const BIN = path.join(os.homedir(), ".local/bin");
export const label = (name) => `com.animatic-lessons.${name}`;
export const nodeOk = (v = process.versions.node) => { const [a, b] = v.split(".").map(Number); return a > 22 || (a === 22 && b >= 5); };
export const which = (cmd) => { try { return execFileSync("which", [cmd], { encoding: "utf8" }).trim(); } catch { return null; } };
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function plist(name, args, { claude = which("claude"), ffmpeg = which("ffmpeg") } = {}) {
  // launchd starts agents with a bare PATH; the worker needs node, claude and ffmpeg on it.
  const dirs = [path.dirname(process.execPath), claude && path.dirname(claude), ffmpeg && path.dirname(ffmpeg), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"].filter(Boolean);
  const env = { PATH: [...new Set(dirs)].join(":"), HOME: os.homedir(), ...(process.env.LESSONS_HOME ? { LESSONS_HOME: process.env.LESSONS_HOME } : {}), ...(process.env.LESSONS_LIBRARY ? { LESSONS_LIBRARY: process.env.LESSONS_LIBRARY } : {}) };
  const log = path.join(HOME, "logs", `${name}.log`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label(name)}</string>
  <key>ProgramArguments</key><array>${[process.execPath, CLI, ...args].map((a) => `<string>${xml(a)}</string>`).join("")}</array>
  <key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k, v]) => `<key>${k}</key><string>${xml(v)}</string>`).join("")}</dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>
`;
}

const mac = () => { if (process.platform !== "darwin") throw new Error("install is for macOS (launchd). Elsewhere, run `lessons serve` and `lessons work` under your own process manager."); };
const domain = () => `gui/${process.getuid()}`;
const stop = (name) => spawnSync("launchctl", ["bootout", `${domain()}/${label(name)}`], { stdio: "ignore" });

export function install({ port = 4747 } = {}) {
  mac();
  if (!nodeOk()) throw new Error(`the queue needs Node 22.5 or later (node:sqlite); this is ${process.version}. Run install with a newer node.`);
  if (!which("claude")) throw new Error("the worker runs `claude`, which is not on PATH. Install Claude Code, then run install again.");
  if (!which("ffmpeg")) throw new Error("the build needs ffmpeg, which is not on PATH (brew install ffmpeg), then run install again.");
  for (const d of [AGENTS, BIN, path.join(HOME, "logs")]) fs.mkdirSync(d, { recursive: true });
  for (const [name, args] of [["site", ["serve", "--port", String(port)]], ["worker", ["work"]]]) {
    const file = path.join(AGENTS, `${label(name)}.plist`);
    stop(name);
    fs.writeFileSync(file, plist(name, args));
    const r = spawnSync("launchctl", ["bootstrap", domain(), file], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`launchctl could not start ${name}: ${r.stderr.trim()}`);
  }
  const link = path.join(BIN, "lessons");
  fs.rmSync(link, { force: true });
  fs.symlinkSync(CLI, link);
  console.log(`Installed. The site is at http://localhost:${port}; the worker is waiting for requests.
  command  ${link}${(process.env.PATH ?? "").split(":").includes(BIN) ? "" : `   (add ${BIN} to PATH)`}
  logs     ${path.join(HOME, "logs")}
  stop     lessons uninstall`);
}

export function uninstall() {
  mac();
  for (const name of ["site", "worker"]) { stop(name); fs.rmSync(path.join(AGENTS, `${label(name)}.plist`), { force: true }); }
  fs.rmSync(path.join(BIN, "lessons"), { force: true });
  console.log(`Stopped and removed. The queue and the library are kept in ${HOME}.`);
}
