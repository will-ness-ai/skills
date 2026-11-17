// The queue: one SQLite file, shared by the CLI, the worker and the site.
// node:sqlite ships with Node 22.5+, so the service has no dependencies.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.removeAllListeners("warning"); // node:sqlite prints an ExperimentalWarning on every run
process.on("warning", (w) => { if (w.name !== "ExperimentalWarning") console.error(w.stack ?? String(w)); });
const { DatabaseSync } = await import("node:sqlite");

export const HOME = process.env.LESSONS_HOME ?? path.join(os.homedir(), ".animatic-lessons");
export const LIBRARY = process.env.LESSONS_LIBRARY ?? path.join(HOME, "library");
export const STAGES = ["context", "course", "research", "plan", "write", "learner", "frames", "render"];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request TEXT NOT NULL,            -- what the user wants to learn, in the requester's words
  transcript_path TEXT,             -- the requesting session's transcript, for nearby context
  message_id TEXT,                  -- the message in it that the request came from
  cwd TEXT,                         -- where the requesting agent was working
  course TEXT,                      -- a course slug, once the worker has placed the request
  status TEXT NOT NULL DEFAULT 'queued',   -- queued | working | done | failed
  stage TEXT,                       -- one of STAGES while working
  note TEXT,                        -- the worker's latest one-line note
  summary TEXT,                     -- what was made, or why it failed
  worker TEXT,
  session_id TEXT,                  -- the worker agent's own session
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS request_lessons (
  request_id INTEGER NOT NULL, course TEXT NOT NULL, lesson TEXT NOT NULL,
  PRIMARY KEY (request_id, course, lesson)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,               -- queued | claimed | stage | say | tool | log | lesson | done | failed
  text TEXT
);
CREATE INDEX IF NOT EXISTS events_request ON events (request_id, id);
`;

export function open(file = path.join(HOME, "lessons.db")) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(LIBRARY, { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  const now = () => Date.now();
  const event = (id, kind, text = null) => db.prepare("INSERT INTO events (request_id, ts, kind, text) VALUES (?, ?, ?, ?)").run(id, now(), kind, text);
  const get = (id) => db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
  const need = (id) => get(id) ?? fail(`no request ${id}`);
  const fail = (m) => { throw new Error(m); };
  return {
    db,
    get,
    add({ request, transcript_path = null, message_id = null, cwd = null, course = null }) {
      if (!request?.trim()) fail("a request needs text: what should the lesson teach?");
      const { lastInsertRowid: id } = db.prepare("INSERT INTO requests (request, transcript_path, message_id, cwd, course, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(request.trim(), transcript_path, message_id, cwd, course, now());
      event(id, "queued", request.trim());
      return get(Number(id));
    },
    // Oldest queued request, claimed in one statement so two workers never share one.
    claim(worker = "worker") {
      const row = db.prepare("UPDATE requests SET status = 'working', stage = 'context', worker = ?, claimed_at = ?, attempts = attempts + 1 WHERE id = (SELECT id FROM requests WHERE status = 'queued' ORDER BY id LIMIT 1) RETURNING *").get(worker, now());
      if (row) event(row.id, "claimed", worker);
      return row ?? null;
    },
    stage(id, stage, note = null) {
      if (!STAGES.includes(stage)) fail(`unknown stage "${stage}"; use one of ${STAGES.join(", ")}`);
      need(id);
      db.prepare("UPDATE requests SET stage = ?, note = ? WHERE id = ?").run(stage, note, id);
      event(id, "stage", note ? `${stage}: ${note}` : stage);
    },
    log(id, kind, text) { need(id); event(id, kind, text); if (kind === "log") db.prepare("UPDATE requests SET note = ? WHERE id = ?").run(text, id); },
    session(id, session_id) { db.prepare("UPDATE requests SET session_id = ? WHERE id = ?").run(session_id, id); },
    attach(id, course, lesson = null) {
      need(id);
      db.prepare("UPDATE requests SET course = ? WHERE id = ?").run(course, id);
      if (lesson) { db.prepare("INSERT OR IGNORE INTO request_lessons VALUES (?, ?, ?)").run(id, course, lesson); event(id, "lesson", `${course}/${lesson}`); }
    },
    // A lesson folder the agent renamed, merged or dropped.
    detach(id, course, lesson) { need(id); db.prepare("DELETE FROM request_lessons WHERE request_id = ? AND course = ? AND lesson = ?").run(id, course, lesson); event(id, "log", `dropped ${course}/${lesson}`); },
    finish(id, status, summary = null) {
      need(id);
      db.prepare("UPDATE requests SET status = ?, summary = ?, finished_at = ? WHERE id = ?").run(status, summary, now(), id);
      event(id, status, summary);
    },
    requeue(id) { need(id); db.prepare("UPDATE requests SET status = 'queued', stage = NULL, note = NULL, summary = NULL, worker = NULL, session_id = NULL, claimed_at = NULL, finished_at = NULL WHERE id = ?").run(id); event(id, "queued", "requeued"); },
    // Requests a dead worker left behind go back on the queue once, then fail.
    recover(worker) {
      for (const r of db.prepare("SELECT * FROM requests WHERE status = 'working' AND worker = ?").all(worker)) {
        if (r.attempts < 2) this.requeue(r.id); else this.finish(r.id, "failed", "the worker stopped twice while making this");
      }
    },
    list(status = null) { return status ? db.prepare("SELECT * FROM requests WHERE status = ? ORDER BY id DESC").all(status) : db.prepare("SELECT * FROM requests ORDER BY id DESC LIMIT 200").all(); },
    lessons(id) { return db.prepare("SELECT course, lesson FROM request_lessons WHERE request_id = ? ORDER BY lesson").all(id).map((r) => ({ ...r })); },
    events(id, after = 0) { return db.prepare("SELECT * FROM events WHERE request_id = ? AND id > ? ORDER BY id").all(id, after); },
    eventsAfter(after = 0) { return db.prepare("SELECT * FROM events WHERE id > ? ORDER BY id LIMIT 500").all(after); },
    lastEventId() { return db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM events").get().id; },
  };
}
