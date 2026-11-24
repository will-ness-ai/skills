// node --test skills/build-with-me/tool/test    (no dependencies; each run gets its own store)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bwm-test-"));
const env = { ...process.env, BWM_DIR: path.join(dir, "store"), BWM_CMD: "bwm" };
const bwm = (...args) => { const r = spawnSync(process.execPath, [path.join(TOOL, "bwm.mjs"), ...args], { encoding: "utf8", env, cwd: dir }); return { out: r.stdout, err: r.stderr, code: r.status }; };
const { open } = await import("../lib/store.mjs");
const { serve } = await import("../lib/server.mjs");
const { render } = await import("../lib/render.mjs");

test("the bare run with no goal says so and how to start", () => {
  const r = bwm();
  assert.equal(r.code, 0);
  assert.match(r.out, /^goal: none yet/m);
  assert.match(r.out, /help\[2\]:\n {2}bwm start --title/);
});

test("usage errors exit 2 and print that command's help, before anything runs", () => {
  let r = bwm("start", "--title", "x");
  assert.equal(r.code, 2); assert.match(r.out, /error: missing --goal/); assert.match(r.out, /usage: bwm start/);
  r = bwm("cards", "--nope"); assert.equal(r.code, 2); assert.match(r.out, /unknown flag --nope/);
  r = bwm("frobnicate"); assert.equal(r.code, 2); assert.match(r.out, /unknown command "frobnicate"/);
  r = bwm("card", "add", "--phase", "decide"); assert.equal(r.code, 2); assert.match(r.out, /needs --phase and --title/);
  assert.equal(r.err, "");
});

test("a goal, a question, the human's answer, then the decision", () => {
  assert.equal(bwm("start", "--title", "Phone access", "--goal", "Reach the site from the phone", "--done", "Phone works").code, 0);
  let r = bwm("ask", "--topic", "Trust", "--title", "Trust the login?", "--option", "Login|only you", "--option", "Tailnet|anyone on it", "--rec", "1");
  assert.match(r.out, /^asked: card (\d+)/m);
  const id = Number(r.out.match(/card (\d+)/)[1]);
  r = bwm("ask", "--topic", "T", "--title", "Bad", "--option", "no pipe"); assert.equal(r.code, 2);
  r = bwm(); assert.match(r.out, new RegExp(`your-turn\\[1\\]\\{id,phase,status,title\\}:\\n  ${id},decide,answer,Trust the login\\?`));
  const st = open(env.BWM_DIR);
  st.submit({ answers: { [id]: { pick: "1", take: "only me, ever" } }, seen: [] });
  r = bwm("answers");
  assert.match(r.out, /answers\[1\]\{card,title,answer\}:/);
  assert.match(r.out, /picked 1: Login; \\"only me, ever\\"/);
  assert.match(r.out, new RegExp(`bwm decide ${id} --text`));
  assert.equal(st.card(id).status, "working");
  assert.match(bwm("answers").out, /answers: none unread/);
  r = bwm("decide", String(id), "--text", "Only your login is trusted.", "--why", "your tokens");
  assert.equal(r.code, 0);
  const d = st.decisions().find((x) => x.text === "Only your login is trusted.");
  assert.equal(d.status, "settled"); assert.match(d.answer, /picked 1/);
  assert.equal(st.card(id).status, "done");
});

test("teach-me-more and bake-off answers don't ask for a decision yet", () => {
  const st = open(env.BWM_DIR);
  const id = st.ask({ title: "Which store?", topic: "Data", options: ["A|x", "B|y"], rec: 1 });
  st.submit({ answers: { [id]: { unsure: true } } });
  const r = bwm("answers");
  assert.match(r.out, /unsure/); assert.doesNotMatch(r.out, new RegExp(`decide ${id}`));
  assert.equal(st.card(id).note, "teaching you more first");
});

test("a proof needs a step to pass, warns without a control, and a check goes to the human", () => {
  const ev = path.join(dir, "out.txt"); fs.writeFileSync(ev, "curl: (6) Could not resolve host\n");
  let r = bwm("proof", "add", "--kind", "hardening", "--title", "Internet can't reach it");
  const id = Number(r.out.match(/proof (\d+)/)[1]);
  r = bwm("proof", "pass", String(id)); assert.equal(r.code, 1); assert.match(r.out, /has no steps yet/);
  r = bwm("proof", "step", String(id), "--did", "curl from a VM", "--expected", "no resolve", "--got", "no resolve", "--evidence", ev);
  assert.match(r.out, /help\[\d\]:\n {2}bwm proof control/);
  r = bwm("proof", "pass", String(id)); assert.match(r.out, /proven/); assert.match(r.out, /warning: no control run/);
  assert.match(bwm("proof", "pass", String(id)).out, /\(no-op\)/);
  r = bwm("proof", "add", "--kind", "nope", "--title", "x"); assert.equal(r.code, 1); assert.match(r.out, /unknown proof kind "nope"/);
  r = bwm("proofs"); assert.match(r.out, /coverage: golden 0\/0, edge 0\/0, error 0\/0, hardening 1\/1/); assert.match(r.out, /gaps: no golden, edge, error proof yet/);
  r = bwm("proof", "step", String(id), "--did", "x", "--evidence", "/no/such/file"); assert.equal(r.code, 1); assert.match(r.out, /no file at/);
});

test("done cards stay unseen until acknowledged; mutations repeat safely", () => {
  const st = open(env.BWM_DIR);
  const id = st.addCard({ phase: "understand", title: "Brief", status: "working" });
  assert.equal(st.setCard(id, { status: "done" }), true);
  assert.equal(st.card(id).seen_at, null);
  assert.equal(st.setCard(id, { status: "done" }), false);
  st.seen([id]); assert.ok(st.card(id).seen_at);
  assert.match(bwm("card", "set", String(id), "--status", "done").out, /\(no-op\)/);
  assert.equal(bwm("card", "set", String(id), "--status", "finished").code, 1);
});

test("render inlines state and evidence into one file", () => {
  const st = open(env.BWM_DIR), file = path.join(dir, "page.html");
  const r = render(st, path.join(TOOL, "page"), file);
  const html = fs.readFileSync(file, "utf8");
  assert.ok(r.bytes > 1000);
  assert.match(html, /window\.BWM_STATE = \{/);
  assert.match(html, /Could not resolve host/);
  assert.doesNotMatch(html, /src="app\.js"/);
  assert.match(html, /<title>Phone access<\/title>/);
});

test("the live server takes a submit, refuses other hosts, and wait applies it", async () => {
  const st = open(env.BWM_DIR);
  const id = st.ask({ title: "Ship it?", topic: "Ship", options: ["Yes|ship", "No|wait"], rec: 1 });
  const { server, url } = await serve(st, { port: 0, page: path.join(TOOL, "page") });
  try {
    const state = await (await fetch(url + "api/state")).json();
    assert.ok(state.cards.some((c) => c.id === id));
    assert.ok(state.cards.filter((c) => c.kind === "proof").every((c) => c.steps.every((s) => !s.evidence || s.term || s.src)));
    const bad = await new Promise((ok) => http.request(url + "api/state", { headers: { host: "evil.example" } }, (res) => { res.resume(); ok(res.statusCode); }).end());
    assert.equal(bad, 403);
    const ok = await fetch(url + "api/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: { [id]: { pick: "1" } } }) });
    assert.equal(ok.status, 200);
    assert.equal((await fetch(url + "nope.js")).status, 404);
  } finally { server.close(); }
  const r = bwm("wait", "--timeout", "5");
  assert.match(r.out, /Ship it\?,"picked 1: Yes"/);
});

test("import takes the reply pasted from a rendered page", () => {
  const st = open(env.BWM_DIR);
  const id = st.ask({ title: "Paste me?", topic: "Paste", options: ["Yes|y"] });
  const r = bwm("import", "--reply", `My answers...\n- Paste me?: option 1\n\nbwm-answers {"answers":{"${id}":{"pick":"1"}},"seen":[]}`);
  assert.equal(r.code, 0); assert.match(r.out, /Paste me\?,"picked 1: Yes"/);
  assert.equal(bwm("import", "--reply", "nothing here").code, 1);
});
