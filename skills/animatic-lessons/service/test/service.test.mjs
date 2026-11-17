// node --test service/test    (no dependencies; each test gets its own LESSONS_HOME)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SERVICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "lessons-test-"));
process.env.LESSONS_HOME = home;
const { open, LIBRARY } = await import("../lib/db.mjs");
const { record, run, work, prompt } = await import("../lib/worker.mjs");
const library = await import("../lib/library.mjs");
const { serve } = await import("../lib/server.mjs");
const { plist } = await import("../lib/install.mjs");
const q = open();
const cli = (...args) => spawnSync(process.execPath, [path.join(SERVICE, "bin/lessons.mjs"), ...args], { encoding: "utf8", env: { ...process.env, LESSONS_HOME: home } });

test("a request is claimed once, oldest first", () => {
  const a = q.add({ request: "first" }), b = q.add({ request: "second" });
  assert.equal(q.claim("w1").id, a.id);
  assert.equal(q.claim("w2").id, b.id);
  assert.equal(q.claim("w3"), null);
  assert.equal(q.get(a.id).status, "working");
  assert.equal(q.get(a.id).stage, "context");
  q.finish(a.id, "done", "made"); q.finish(b.id, "done", "made");
});

test("stages are a fixed list, and every change is an event", () => {
  const r = q.add({ request: "stages" }); q.claim("w");
  q.stage(r.id, "research", "reading the docs");
  assert.throws(() => q.stage(r.id, "thinking"), /unknown stage/);
  q.attach(r.id, "demo", "0001-first");
  q.attach(r.id, "demo", "0009-renamed"); q.detach(r.id, "demo", "0009-renamed");
  q.finish(r.id, "done", "one lesson");
  assert.deepEqual(q.events(r.id).map((e) => e.kind), ["queued", "claimed", "stage", "lesson", "lesson", "log", "done"]);
  assert.deepEqual(q.lessons(r.id), [{ course: "demo", lesson: "0001-first" }]);
});

test("a request a dead worker held is requeued once, then failed", () => {
  const r = q.add({ request: "orphan" });
  q.claim("host:worker"); q.recover("host:worker");
  assert.equal(q.get(r.id).status, "queued");
  q.claim("host:worker"); q.recover("host:worker");
  assert.equal(q.get(r.id).status, "failed");
});

test("the agent's stream becomes events: what it says, and each tool call", () => {
  const r = q.add({ request: "stream" }); q.claim("w");
  record(q, r.id, JSON.stringify({ type: "system", subtype: "init", session_id: "abc" }));
  record(q, r.id, JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Reading the transcript." }, { type: "tool_use", name: "Bash", input: { command: "lessons courses" } }] } }));
  record(q, r.id, JSON.stringify({ type: "assistant", parent_tool_use_id: "t1", message: { content: [{ type: "text", text: "a subagent's words stay out" }] } }));
  record(q, r.id, "not json");
  assert.equal(q.get(r.id).session_id, "abc");
  assert.deepEqual(q.events(r.id).slice(2).map((e) => [e.kind, e.text]), [["say", "Reading the transcript."], ["tool", "Bash lessons courses"]]);
  q.finish(r.id, "done");
});

test("the worker runs one agent per request, and a request the agent leaves open fails", async () => {
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ agent: [process.execPath, "-e", `console.log(JSON.stringify({type:"assistant",message:{content:[{type:"text",text:"hello from request " + process.env.LESSONS_REQUEST}]}}))`] }));
  const r = q.add({ request: "left open", transcript_path: "/x/session.jsonl", message_id: "m1" });
  await work(q, { once: true, log: () => {} });
  assert.equal(q.get(r.id).status, "failed");
  assert.match(q.get(r.id).summary, /without finishing/);
  assert.ok(q.events(r.id).some((e) => e.kind === "say" && e.text === `hello from request ${r.id}`));
  const p = prompt(q.get(r.id));
  assert.match(p, /\/x\/session\.jsonl/); assert.match(p, /m1/); assert.doesNotMatch(p, /\{\{/);
});

test("an agent that closes its request is done", async () => {
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ agent: [process.execPath, "-e", `require("node:child_process").execFileSync(process.execPath, [${JSON.stringify(path.join(SERVICE, "bin/lessons.mjs"))}, "done", process.env.LESSONS_REQUEST, "made one lesson"])`] }));
  const r = q.add({ request: "closed" });
  await run(q, q.claim("w"));
  assert.equal(q.get(r.id).status, "done");
  assert.equal(q.get(r.id).summary, "made one lesson");
});

test("the command line: request, list, and errors that say what to do", () => {
  const out = cli("request", "how does DERP pick a region", "--transcript", "/tmp/t.jsonl", "--message", "u-42", "--course", "tailscale");
  assert.match(out.stdout, /queued request \d+/);
  const id = Number(/request (\d+)/.exec(out.stdout)[1]), r = q.get(id);
  assert.deepEqual([r.transcript_path, r.message_id, r.course], ["/tmp/t.jsonl", "u-42", "tailscale"]);
  assert.match(cli("list", "queued").stdout, /how does DERP pick a region/);
  assert.equal(cli("request").status, 1);
  assert.match(cli("stage", String(id), "nope").stderr, /unknown stage/);
  assert.match(cli("bogus").stderr, /lessons help/);
  q.finish(id, "done");
});

test("the library reads courses from folders, and the site serves them", async () => {
  const dir = path.join(LIBRARY, "demo/lessons/0001-first");
  fs.mkdirSync(path.join(dir, "build"), { recursive: true });
  fs.writeFileSync(path.join(LIBRARY, "demo/course.json"), JSON.stringify({ title: "Demo", about: "A demo." }));
  fs.writeFileSync(path.join(dir, "lesson.json"), JSON.stringify({ title: "First", lede: "The first one.", questions: [{ q: "Q?", a: "A." }] }));
  fs.writeFileSync(path.join(dir, "storyboard.src.json"), JSON.stringify({ moments: [{ say: "S S H", text: "SSH" }, { say: "two" }] }));
  fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify([{ start: 0, seconds: 4, cut: true }, { start: 4, seconds: 6 }]));
  fs.writeFileSync(path.join(dir, "animatic.mp4"), "0123456789");
  fs.writeFileSync(path.join(dir, "build/01.png"), "png");
  const [c] = library.courses();
  assert.deepEqual([c.slug, c.title, c.lessons[0].title, c.lessons[0].seconds], ["demo", "Demo", "First", 10]);
  assert.deepEqual(library.lesson("demo", "0001-first", { detail: true }).transcript.map((t) => t.text), ["SSH", "two"]);

  const server = await serve(q, { port: 0 }), base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(`${base}/api/courses`)).json())[0].lessons[0].video, "/library/demo/lessons/0001-first/animatic.mp4");
    const part = await fetch(`${base}/library/demo/lessons/0001-first/animatic.mp4`, { headers: { Range: "bytes=2-5" } });
    assert.deepEqual([part.status, await part.text(), part.headers.get("content-range")], [206, "2345", "bytes 2-5/10"]);
    assert.equal((await fetch(`${base}/library/..%2f..%2flessons.db`)).status, 404);
    assert.match(await (await fetch(`${base}/queue/3`)).text(), /<main id="main">/);
    const made = await (await fetch(`${base}/api/requests`, { method: "POST", body: JSON.stringify({ request: "from the site" }) })).json();
    const got = await (await fetch(`${base}/api/requests/${made.id}`)).json();
    assert.deepEqual([got.status, got.events[0].kind], ["queued", "queued"]);
    assert.equal((await fetch(`${base}/api/requests`, { method: "POST", body: "{}" })).status, 400);
    q.finish(made.id, "done");
  } finally { server.closeAllConnections(); server.close(); }
});

test("the launchd agents carry a PATH that finds node, claude and ffmpeg", () => {
  const p = plist("worker", ["work"], { claude: "/opt/tools/claude", ffmpeg: "/opt/media/ffmpeg" });
  assert.match(p, /com\.animatic-lessons\.worker/);
  assert.match(p, /<string>work<\/string>/);
  assert.match(p, /\/opt\/tools:\/opt\/media:/);
  assert.match(p, /<key>KeepAlive<\/key><true\/>/);
});
