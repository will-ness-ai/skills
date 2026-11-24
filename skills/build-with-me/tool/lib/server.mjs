// The live page: serves the page, its state, evidence files, and takes the human's Submit.
// Binds to 127.0.0.1 and answers only to localhost Host headers, so another site can't reach it.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { withEvidence, MIME } from "./evidence.mjs";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

export function serve(st, { port = 4848, page }) {
  const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  const read = (req) => new Promise((ok, bad) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 1e6) { bad(new Error("too large")); req.destroy(); } }); req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { bad(e); } }); });
  const server = http.createServer(async (req, res) => {
    const host = (req.headers.host || "").replace(/:\d+$/, "");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host)) return send(res, 403, { error: "localhost only" });
    const url = new URL(req.url, "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/api/state") {
        const s = st.state(); if (!s) return send(res, 404, { error: "no goal" });
        return send(res, 200, withEvidence(s, (step) => `api/file/${step.id}`));
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/file/")) {
        const id = Number(url.pathname.split("/").pop());
        const row = st.step(id);
        if (!row?.evidence || !fs.existsSync(row.evidence)) return send(res, 404, { error: "no file" });
        return send(res, 200, fs.readFileSync(row.evidence), MIME[path.extname(row.evidence).toLowerCase()] ?? "application/octet-stream");
      }
      if (req.method === "POST" && url.pathname === "/api/submit") {
        if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "json only" });
        const body = await read(req); const id = st.submit({ answers: body.answers ?? {}, seen: body.seen ?? [], note: body.note ?? null });
        return send(res, 200, { ok: true, id });
      }
      if (req.method === "POST" && url.pathname === "/api/seen") {
        if (!(req.headers["content-type"] || "").startsWith("application/json")) return send(res, 415, { error: "json only" });
        const body = await read(req); st.seen((body.ids ?? []).map(Number).filter(Number.isInteger)); return send(res, 200, { ok: true });
      }
      if (req.method === "GET") {
        const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        if (!/^[\w.-]+$/.test(name) || !fs.existsSync(path.join(page, name))) return send(res, 404, "not found", "text/plain");
        return send(res, 200, fs.readFileSync(path.join(page, name)), TYPES[path.extname(name)] ?? "text/plain");
      }
      send(res, 405, { error: "method not allowed" });
    } catch (e) { send(res, 400, { error: e.message }); }
  });
  return new Promise((ok, bad) => {
    server.once("error", (e) => bad(e.code === "EADDRINUSE" ? Object.assign(new Error(`port ${port} is in use`), { port }) : e));
    server.listen(port, "127.0.0.1", () => ok({ server, url: `http://localhost:${server.address().port}/` }));
  });
}
