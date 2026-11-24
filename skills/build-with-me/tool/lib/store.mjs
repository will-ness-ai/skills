// The page's state: one SQLite file per project, shared by the CLI and the page server.
// node:sqlite ships with Node 22.13+, so the tool has no dependencies.
import fs from "node:fs";
import path from "node:path";

process.removeAllListeners("warning"); // node:sqlite prints an ExperimentalWarning on every run
process.on("warning", (w) => { if (w.name !== "ExperimentalWarning") console.error(w.stack ?? String(w)); });
const { DatabaseSync } = await import("node:sqlite").catch(() => {
  console.log(`error: build-with-me needs Node 22.13 or later (node:sqlite); this is ${process.version}.`);
  process.exit(1);
});

export const PHASES = ["understand", "decide", "prove", "ship", "watch"];
// Who holds each status: "you" (the human), "claude", or nobody.
export const STATUS = { answer: "you", check: "you", working: "claude", failed: "claude", waiting: null, expected: null, done: null };
export const KINDS = ["golden", "edge", "error", "hardening"];
export const DECISION = ["settled", "open", "next"];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,            -- the page heading, a few words
  goal TEXT NOT NULL,             -- one sentence: what the human gets
  why TEXT,                       -- why it matters, in the human's terms
  ask TEXT,                       -- what Claude needs from the human right now
  today TEXT, after TEXT,         -- JSON arrays of short bullets
  picture TEXT,                   -- an SVG drawing of the after state; decisions pin onto it
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS done_when (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL,
  text TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'open'     -- open | working | done
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL,
  phase TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'note',      -- note | question | proof
  title TEXT NOT NULL, status TEXT NOT NULL, note TEXT,
  body TEXT,                      -- markdown for notes; JSON for questions and proofs
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  done_at INTEGER, seen_at INTEGER
);
CREATE TABLE IF NOT EXISTS steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, card_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'step',   -- step | control
  did TEXT NOT NULL, expected TEXT, got TEXT,
  evidence TEXT,                  -- a file path: screenshot, video or captured terminal output
  term TEXT                       -- captured terminal text, when there is no file
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL,
  topic TEXT NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL,
  asked TEXT, answer TEXT, why TEXT,
  card_id INTEGER,                -- the question card it came from, while open
  pin_x REAL, pin_y REAL,         -- where it sits on the picture, in the SVG's own units
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL,
  ts INTEGER NOT NULL, payload TEXT NOT NULL, read_at INTEGER
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, goal_id INTEGER NOT NULL, ts INTEGER NOT NULL, text TEXT NOT NULL
);
`;

export class UserError extends Error { constructor(msg, help = []) { super(msg); this.help = help; } }

const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

export function open(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "bwm.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  const now = () => Date.now();
  const q = (sql) => db.prepare(sql);
  const s = {
    dir, db, now,
    goal() { return q("SELECT * FROM goals ORDER BY id DESC LIMIT 1").get() ?? null; },
    needGoal() { const g = s.goal(); if (!g) throw new UserError("no goal yet", ['bwm start --title "<few words>" --goal "<one sentence>" --why "<why it matters>" --done "<done when>"']); return g; },
    log(text) { const g = s.goal(); if (g) q("INSERT INTO events (goal_id, ts, text) VALUES (?, ?, ?)").run(g.id, now(), text); },
    touch() { const g = s.goal(); if (g) q("UPDATE goals SET updated_at = ? WHERE id = ?").run(now(), g.id); },

    start({ title, goal, why = null, ask = null, done = [] }) {
      const t = now();
      const { lastInsertRowid: id } = q("INSERT INTO goals (title, goal, why, ask, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(title, goal, why, ask, t, t);
      for (const d of done) q("INSERT INTO done_when (goal_id, text) VALUES (?, ?)").run(id, d);
      s.log(`Started: ${title}`);
      return s.goal();
    },
    setGoal(fields) {
      const g = s.needGoal(), keys = Object.keys(fields).filter((k) => fields[k] !== undefined);
      for (const k of keys) {
        const v = ["today", "after"].includes(k) ? JSON.stringify(fields[k]) : fields[k];
        q(`UPDATE goals SET ${k} = ? WHERE id = ?`).run(v, g.id);
      }
      s.touch();
      return keys;
    },
    doneWhen() { const g = s.goal(); return g ? q("SELECT * FROM done_when WHERE goal_id = ? ORDER BY id").all(g.id) : []; },
    addDone(text) { const g = s.needGoal(); return Number(q("INSERT INTO done_when (goal_id, text) VALUES (?, ?)").run(g.id, text).lastInsertRowid); },
    markDone(id, state) {
      if (!["open", "working", "done"].includes(state)) throw new UserError(`unknown state "${state}": use open, working or done`);
      const r = q("SELECT * FROM done_when WHERE id = ?").get(id); if (!r) throw new UserError(`no done-when line ${id}`, ["bwm goal"]);
      if (r.state === state) return false;
      q("UPDATE done_when SET state = ? WHERE id = ?").run(state, id); s.touch(); return true;
    },

    card(id) { const c = q("SELECT * FROM cards WHERE id = ?").get(id); if (!c) throw new UserError(`no card ${id}`, ["bwm cards"]); return c; },
    cards(where = {}) {
      const g = s.goal(); if (!g) return [];
      let sql = "SELECT * FROM cards WHERE goal_id = ?", args = [g.id];
      for (const k of ["phase", "status", "kind"]) if (where[k]) { sql += ` AND ${k} = ?`; args.push(where[k]); }
      return q(sql + " ORDER BY id").all(...args);
    },
    addCard({ phase, kind = "note", title, status = "working", note = null, body = null }) {
      const g = s.needGoal();
      if (!PHASES.includes(phase)) throw new UserError(`unknown phase "${phase}": use ${PHASES.join(", ")}`);
      if (!(status in STATUS)) throw new UserError(`unknown status "${status}": use ${Object.keys(STATUS).join(", ")}`);
      const t = now();
      const id = Number(q("INSERT INTO cards (goal_id, phase, kind, title, status, note, body, created_at, updated_at, done_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(g.id, phase, kind, title, status, note, typeof body === "string" || body === null ? body : JSON.stringify(body), t, t, status === "done" ? t : null).lastInsertRowid);
      s.touch(); return id;
    },
    setCard(id, { status, note, title, phase, body }) {
      const c = s.card(id), t = now();
      if (status !== undefined && !(status in STATUS)) throw new UserError(`unknown status "${status}": use ${Object.keys(STATUS).join(", ")}`);
      if (phase !== undefined && !PHASES.includes(phase)) throw new UserError(`unknown phase "${phase}": use ${PHASES.join(", ")}`);
      const next = { status: status ?? c.status, note: note === undefined ? c.note : note, title: title ?? c.title, phase: phase ?? c.phase,
        body: body === undefined ? c.body : typeof body === "string" ? body : JSON.stringify(body) };
      if (Object.keys(next).every((k) => next[k] === c[k])) return false;
      const doneAt = next.status === "done" ? (c.status === "done" ? c.done_at : t) : null;
      q("UPDATE cards SET status = ?, note = ?, title = ?, phase = ?, body = ?, updated_at = ?, done_at = ?, seen_at = CASE WHEN ? THEN NULL ELSE seen_at END WHERE id = ?")
        .run(next.status, next.note, next.title, next.phase, next.body, t, doneAt, next.status === "done" && c.status !== "done" ? 1 : 0, id);
      s.touch(); return true;
    },
    seen(ids) { const t = now(); for (const id of ids) q("UPDATE cards SET seen_at = ? WHERE id = ? AND seen_at IS NULL").run(t, id); },

    ask({ title, topic, know = [], options = [], rec = null, why = null, flips = null, shape = null, phase = "decide" }) {
      if (options.length && rec !== null && !(rec >= 1 && rec <= options.length)) throw new UserError(`--rec ${rec} is not one of the ${options.length} options`);
      const id = s.addCard({ phase, kind: "question", title, status: "answer", note: "your answer", body: { topic, know, options, rec, why, flips, shape } });
      const t = now(), g = s.goal();
      q("INSERT INTO decisions (goal_id, topic, text, status, asked, card_id, created_at, updated_at) VALUES (?, ?, ?, 'open', ?, ?, ?, ?)").run(g.id, topic, title, title, id, t, t);
      s.log(`Asked: ${title}`);
      return id;
    },
    decisions() { const g = s.goal(); return g ? q("SELECT * FROM decisions WHERE goal_id = ? ORDER BY CASE status WHEN 'settled' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, id").all(g.id) : []; },
    decision(id) { const d = q("SELECT * FROM decisions WHERE id = ?").get(id); if (!d) throw new UserError(`no decision ${id}`, ["bwm design"]); return d; },
    addDecision({ topic, text, status = "settled", asked = null, answer = null, why = null }) {
      if (!DECISION.includes(status)) throw new UserError(`unknown decision status "${status}": use ${DECISION.join(", ")}`);
      const g = s.needGoal(), t = now();
      const id = Number(q("INSERT INTO decisions (goal_id, topic, text, status, asked, answer, why, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(g.id, topic, text, status, asked, answer, why, t, t).lastInsertRowid);
      s.touch(); return id;
    },
    // Settle the open decision behind a question card: the plain sentence, the human's answer, why.
    decide(cardId, { text, answer, why, topic }) {
      const c = s.card(cardId); if (c.kind !== "question") throw new UserError(`card ${cardId} is not a question`, ["bwm cards --kind question"]);
      const d = q("SELECT * FROM decisions WHERE card_id = ?").get(cardId);
      const t = now();
      q("UPDATE decisions SET text = ?, status = 'settled', answer = COALESCE(?, answer), why = COALESCE(?, why), topic = COALESCE(?, topic), updated_at = ? WHERE id = ?").run(text, answer ?? null, why ?? null, topic ?? null, t, d.id);
      s.setCard(cardId, { status: "done", note: "decided" });
      s.log(`Decided: ${text}`);
      return d.id;
    },
    setDecision(id, f) {
      const d = s.decision(id);
      if (f.status && !DECISION.includes(f.status)) throw new UserError(`unknown decision status "${f.status}": use ${DECISION.join(", ")}`);
      const next = { ...d, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) };
      q("UPDATE decisions SET topic = ?, text = ?, status = ?, asked = ?, answer = ?, why = ?, pin_x = ?, pin_y = ?, updated_at = ? WHERE id = ?")
        .run(next.topic, next.text, next.status, next.asked, next.answer, next.why, next.pin_x, next.pin_y, now(), id);
      s.touch();
    },

    addProof({ kind, title, claim = null, setup = [], planned = false, phase = "prove" }) {
      if (!KINDS.includes(kind)) throw new UserError(`unknown proof kind "${kind}": use ${KINDS.join(", ")}`);
      return s.addCard({ phase, kind: "proof", title, status: planned ? "expected" : "working", note: planned ? "planned" : "proving", body: { kind, claim, setup, try: null } });
    },
    proof(id) { const c = s.card(id); if (c.kind !== "proof") throw new UserError(`card ${id} is not a proof`, ["bwm proofs"]); return { ...c, body: J(c.body, {}), steps: s.steps(id) }; },
    setProof(id, f) { const p = s.proof(id); s.setCard(id, { body: { ...p.body, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) } }); },
    steps(id) { return q("SELECT * FROM steps WHERE card_id = ? ORDER BY role = 'control', id").all(id); },
    addStep(id, { role = "step", did, expected = null, got = null, evidence = null, term = null }) {
      s.proof(id);
      if (evidence && !fs.existsSync(evidence)) throw new UserError(`no file at ${evidence}`);
      const sid = Number(q("INSERT INTO steps (card_id, role, did, expected, got, evidence, term) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, role, did, expected, got, evidence ? path.resolve(evidence) : null, term).lastInsertRowid);
      q("UPDATE cards SET updated_at = ? WHERE id = ?").run(now(), id); s.touch(); return sid;
    },

    submit(payload) { const g = s.needGoal(); return Number(q("INSERT INTO submissions (goal_id, ts, payload) VALUES (?, ?, ?)").run(g.id, now(), JSON.stringify(payload)).lastInsertRowid); },
    unread() { const g = s.goal(); return g ? q("SELECT * FROM submissions WHERE goal_id = ? AND read_at IS NULL ORDER BY id").all(g.id).map((r) => ({ ...r, payload: J(r.payload, {}) })) : []; },
    markRead(id) { q("UPDATE submissions SET read_at = ? WHERE id = ?").run(now(), id); },
    // What a submission changes on the board; returns one line per change for the agent.
    apply(sub) {
      const out = [], p = sub.payload ?? {};
      for (const [id, a] of Object.entries(p.answers ?? {})) {
        let c; try { c = s.card(Number(id)); } catch { out.push({ card: id, title: "(gone)", answer: "card no longer exists" }); continue; }
        const b = J(c.body, {});
        if (c.kind === "question") {
          const opt = a.pick ? b.options?.[Number(a.pick) - 1] : null;
          const flags = ["unsure", "prototype", "bakeoff"].filter((f) => a[f]);
          const answer = [opt ? `picked ${a.pick}: ${opt.split("|")[0]}` : null, flags.length ? flags.join("+") : null, a.take ? `"${a.take}"` : null].filter(Boolean).join("; ") || "(empty)";
          const d = q("SELECT * FROM decisions WHERE card_id = ?").get(c.id);
          if (d) q("UPDATE decisions SET answer = ?, updated_at = ? WHERE id = ?").run(answer, now(), d.id);
          s.setCard(c.id, { status: "working", note: flags.includes("unsure") ? "teaching you more first" : flags.length ? `running a ${flags.includes("bakeoff") ? "bake-off" : "prototype"}` : "your answer is in" });
          out.push({ card: c.id, title: c.title, answer });
        } else if (c.kind === "proof") {
          const ok = a.verdict === "ok";
          s.setCard(c.id, { status: ok ? "done" : "failed", note: ok ? "you checked it" : "you flagged it" });
          out.push({ card: c.id, title: c.title, answer: ok ? "looks right" : `something's off${a.comment ? `: "${a.comment}"` : ""}` });
        } else {
          out.push({ card: c.id, title: c.title, answer: a.take ?? JSON.stringify(a) });
        }
      }
      if (p.seen?.length) s.seen(p.seen);
      if (p.note) out.push({ card: "-", title: "note", answer: `"${p.note}"` });
      s.markRead(sub.id);
      s.log(`You answered ${out.length} item${out.length === 1 ? "" : "s"}`);
      return out;
    },
    events(limit = 20) { const g = s.goal(); return g ? q("SELECT * FROM events WHERE goal_id = ? ORDER BY id DESC LIMIT ?").all(g.id, limit) : []; },

    // Everything the page draws, in one object.
    state() {
      const g = s.goal(); if (!g) return null;
      return {
        goal: { ...g, today: J(g.today, []), after: J(g.after, []) },
        done: s.doneWhen(),
        cards: s.cards().map((c) => ({ ...c, body: c.kind === "note" ? c.body : J(c.body, {}), steps: c.kind === "proof" ? s.steps(c.id) : undefined })),
        decisions: s.decisions(),
        events: s.events(30),
        pending: s.unread().length,
      };
    },
  };
  return s;
}
