// The pasted-reply format (page/reply.js), shared by the page and bwm import, and the CLI contract.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import "../page/reply.js";

const R = globalThis.BWMReply;
const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bwm-reply-"));
const env = { ...process.env, BWM_DIR: path.join(dir, "store"), BWM_CMD: "bwm" };
delete env.CLAUDE_PROJECT_DIR;
const bwm = (...a) => { const r = spawnSync(process.execPath, [path.join(TOOL, "bwm.mjs"), ...a], { encoding: "utf8", env, cwd: dir }); return { out: r.stdout, code: r.status }; };

const take = "Research first: a lot changed.\nBy early value, remember \"why\", too:\n- improve testing\n  - nested, with a comma\n- give agents verification loops \\ tools";

test("what the page encodes, bwm parses back exactly", () => {
  const answers = { 2: { pick: "4", unsure: true, take }, 7: { verdict: "off", comment: "The header wraps" }, 9: { pick: "1" } };
  const text = R.encode(answers, { 2: "What should 'early value' be?", 7: "Looks right, on your phone?", 9: "Ship it?" }, [1, 3]);
  assert.equal(text.split("\n").length, 6, "lead, header, three rows, seen: one line per row whatever the note holds");
  const p = R.parse(text);
  assert.deepEqual(p.answers, { 2: { pick: "4", unsure: true, take }, 7: { verdict: "off", comment: "The header wraps" }, 9: { pick: "1" } });
  assert.deepEqual(p.seen, [1, 3]);
  assert.equal(p.read, p.expected);
});

test("rows survive a paste that lost indentation, CRLF line ends, or real line breaks in a note", () => {
  const text = R.encode({ 2: { pick: "4", take }, 3: { pick: "1" } }, { 2: "Q2", 3: "Q3" });
  const flat = text.split("\n").map((l) => l.trimStart()).join("\r\n");
  assert.deepEqual(R.parse(flat).answers, { 2: { pick: "4", take }, 3: { pick: "1" } });
  const real = text.replace(/\\n/g, "\n"); // a shell's $'…' turns the escapes into newlines
  assert.equal(R.parse(real).answers[2].take, take);
  assert.equal(R.parse(real).answers[3].pick, "1");
});

test("bwm import refuses a reply whose row count doesn't match, and reads UTF-16 files", async () => {
  bwm("start", "--title", "T", "--goal", "G");
  // Created in-process: a spawned import() of a bare Windows drive path fails (it needs a file URL).
  const { open } = await import(pathToFileURL(path.join(TOOL, "lib", "store.mjs")).href);
  const id = String(open(env.BWM_DIR).ask({ title: "Q?", topic: "t", options: ["A|a", "B|b"] }));
  const short = `answers[2]{card,question,pick,flags,verdict,note}:\n  ${id},Q?,1,,,\n`;
  let r = bwm("import", "--reply", short);
  assert.equal(r.code, 1); assert.match(r.out, /says 2 answer\(s\) but 1 row\(s\) read; nothing imported/);
  const f = path.join(dir, "reply.txt");
  fs.writeFileSync(f, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(R.encode({ [id]: { pick: "2", take } }, { [id]: "Q?" }), "utf16le")]));
  r = bwm("import", "--reply-file", f);
  assert.equal(r.code, 0, r.out); assert.match(r.out, /picked 2: B/); assert.match(r.out, /\\n  - nested, with a comma/, "indentation survives in the output");
});

test("the CLI contract: usage errors exit 2, unchanged writes say no-op", () => {
  assert.equal(bwm("card", "show").code, 2);
  assert.equal(bwm("card", "show", "abc").code, 2);
  assert.equal(bwm("cards", "extra").code, 2);
  assert.equal(bwm("card", "set", "1", "2", "--status", "done").code, 2);
  assert.match(bwm("goal", "--goal", "G").out, /goal: \(no-op\)/);
  const r = bwm("goal", "--ask", "x", "--done-state", "abc=done");
  assert.equal(r.code, 2); assert.doesNotMatch(bwm("goal").out, /^ask: x$/m, "a bad --done-state writes nothing");
});
