#!/usr/bin/env node
// lessons: the queue's command line. Agents ask for lessons with it, the worker
// agent reports progress with it, and a person runs the service with it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HOME, LIBRARY, STAGES, open } from "../lib/db.mjs";

const USAGE = `lessons: ask for animatic lessons, and run the service that makes them.

Ask (any agent):
  lessons request "<what to teach, and why it came up>" [--transcript <path>|auto|none] [--message <id>] [--course <slug>]
  lessons list [queued|working|done|failed]      lessons show <id>      lessons courses

Report (the worker agent, on request <id>):
  lessons stage <id> <${STAGES.join("|")}> ["note"]
  lessons log <id> "<one line>"
  lessons attach <id> <course> [<lesson>]        the course it belongs to, each lesson as it is started
  lessons done <id> "<what was made>"            lessons fail <id> "<why>"       lessons requeue <id>

Run (a person):
  lessons serve [--port 4747]                    the site
  lessons work [--once]                          pop requests, one agent each
  lessons install | uninstall                    macOS: keep both running in the background
  lessons home                                   where the queue and the library live

--transcript auto (the default) finds this folder's newest Claude Code session and its last user message.`;

const argv = process.argv.slice(2), verb = argv.shift();
const flags = {}, args = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) { const k = argv[i].slice(2); flags[k] = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? true : argv[++i]; }
  else args.push(argv[i]);
}
const die = (m, code = 1) => { console.error(`lessons: ${m}`); process.exit(code); };
const id = () => { const n = Number(args[0] ?? process.env.LESSONS_REQUEST); if (!Number.isInteger(n)) die("name a request id"); return n; };
const port = () => Number(flags.port ?? process.env.LESSONS_PORT ?? 4747);
const line = (r) => `${String(r.id).padStart(4)}  ${r.status.padEnd(8)}${(r.stage ?? "").padEnd(9)} ${r.course ? `[${r.course}] ` : ""}${r.request.replace(/\s+/g, " ").slice(0, 90)}`;

// The requesting agent's own session: Claude Code keeps one .jsonl per session under
// ~/.claude/projects/<the working directory, with / and . as ->/. The newest is this one.
function session(cwd) {
  const dir = path.join(os.homedir(), ".claude/projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));
  if (!fs.existsSync(dir)) return {};
  const newest = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  if (!newest) return {};
  let message = null;
  for (const l of fs.readFileSync(newest, "utf8").split("\n")) {
    try { const m = JSON.parse(l); if (m.type === "user" && m.uuid && typeof m.message?.content === "string") message = m.uuid; } catch {}
  }
  return { transcript_path: newest, message_id: message };
}

try {
  if (!verb || verb === "help" || flags.help) { console.log(USAGE); process.exit(0); }
  const q = open();
  switch (verb) {
    case "request": {
      const cwd = process.cwd();
      const auto = flags.transcript === "none" ? {} : !flags.transcript || flags.transcript === "auto" ? session(cwd) : { transcript_path: path.resolve(flags.transcript) };
      const r = q.add({ request: args.join(" "), cwd, course: flags.course === true ? null : flags.course ?? null, transcript_path: auto.transcript_path ?? null, message_id: flags.message ?? auto.message_id ?? null });
      console.log(`queued request ${r.id}\nwatch it: http://localhost:${port()}/queue/${r.id}`);
      if (!r.transcript_path) console.log("no transcript found for this folder; pass --transcript <path> to give the worker the conversation around the request");
      break;
    }
    case "list": q.list(args[0] ?? null).reverse().forEach((r) => console.log(line(r))); break;
    case "show": { const r = q.get(id()) ?? die(`no request ${args[0]}`); console.log(JSON.stringify({ ...r, lessons: q.lessons(r.id), events: flags.events ? q.events(r.id) : undefined }, null, 2)); break; }
    case "courses": { const { courses } = await import("../lib/library.mjs"); console.log(JSON.stringify(courses().map((c) => ({ slug: c.slug, title: c.title, about: c.about, folder: path.join(LIBRARY, c.slug), lessons: c.lessons.map((l) => ({ slug: l.slug, title: l.title, lede: l.lede })) })), null, 2)); break; }
    case "claim": { const r = q.claim(flags.worker ?? `${os.hostname()}:manual`); if (!r) process.exit(3); console.log(JSON.stringify(r, null, 2)); break; }
    case "stage": q.stage(id(), args[1] ?? die("name a stage"), args.slice(2).join(" ") || null); break;
    case "log": q.log(id(), "log", args.slice(1).join(" ") || die("say what happened")); break;
    case "attach": q.attach(id(), args[1] ?? die("name the course"), args[2] ?? null); break;
    case "done": q.finish(id(), "done", args.slice(1).join(" ") || null); break;
    case "fail": q.finish(id(), "failed", args.slice(1).join(" ") || die("say why")); break;
    case "requeue": q.requeue(id()); break;
    case "home": console.log(`home     ${HOME}\nqueue    ${path.join(HOME, "lessons.db")}\nlibrary  ${LIBRARY}\nconfig   ${path.join(HOME, "config.json")}\nsite     http://localhost:${port()}`); break;
    case "serve": { const { serve } = await import("../lib/server.mjs"); await serve(q, { port: port(), host: flags.host ?? "127.0.0.1" }); console.log(`lessons: http://localhost:${port()}  (library: ${LIBRARY})`); break; }
    case "work": { const { work } = await import("../lib/worker.mjs"); await work(q, { once: Boolean(flags.once) }); break; }
    case "install": case "uninstall": { const m = await import("../lib/install.mjs"); m[verb]({ port: port() }); break; }
    default: die(`unknown command "${verb}". Run: lessons help`);
  }
} catch (e) { die(e.message); }
