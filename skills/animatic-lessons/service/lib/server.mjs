// The site: the library as courses and lessons, and the queue, live.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BEAT, LIBRARY, STAGES } from "./db.mjs";
import * as library from "./library.mjs";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".mp4": "video/mp4", ".vtt": "text/vtt; charset=utf-8", ".svg": "image/svg+xml", ".md": "text/plain; charset=utf-8" };

function file(req, res, root, rel) {
  const p = path.resolve(root, "." + path.posix.normalize("/" + rel));
  if (!p.startsWith(root + path.sep) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404).end("not found"); return; }
  const size = fs.statSync(p).size, type = TYPES[path.extname(p)] ?? "application/octet-stream";
  // Videos are fetched in ranges; a player cannot seek without them.
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }).end(); return; }
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1, "Accept-Ranges": "bytes" });
    fs.createReadStream(p, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
    fs.createReadStream(p).pipe(res);
  }
}

export function serve(q, { port = 4747, host = "127.0.0.1" } = {}) {
  const send = (res, body, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(body)); };
  const request = (r) => ({ ...r, lessons: q.lessons(r.id).map((l) => library.lesson(l.course, l.lesson)).filter(Boolean) });
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x"), p = decodeURIComponent(url.pathname);
      let m;
      if (p === "/api/courses") return send(res, library.courses());
      if ((m = /^\/api\/courses\/([^/]+)\/lessons\/([^/]+)$/.exec(p))) return send(res, { ...library.lesson(m[1], m[2], { detail: true }), siblings: library.course(m[1])?.lessons ?? [], courseTitle: library.course(m[1])?.title });
      if (p === "/api/requests" && req.method === "GET") return send(res, { stages: STAGES, requests: q.list().map(request) });
      if (p === "/api/requests" && req.method === "POST") {
        // A queued request is run by an agent with a shell, so no other site's page may queue one:
        // a JSON content type forces a preflight on cross-origin posts, and the origin must be this site.
        const origin = req.headers.origin;
        if (!/^application\/json\b/.test(req.headers["content-type"] ?? "") || (origin && new URL(origin).host !== req.headers.host)) return send(res, { error: "requests are queued from this site or the lessons command" }, 403);
        let body = ""; for await (const c of req) body += c;
        return send(res, q.add({ request: JSON.parse(body || "{}").request, cwd: "site" }), 201);
      }
      if ((m = /^\/api\/requests\/(\d+)$/.exec(p))) {
        const r = q.get(Number(m[1]));
        if (!r) return send(res, { error: "no such request" }, 404);
        return send(res, { stages: STAGES, ...r, events: q.events(r.id), lessons: q.lessons(r.id).map((l) => library.lesson(l.course, l.lesson, { detail: true })).filter(Boolean) });
      }
      // One stream for the whole site: every new event, as it is written.
      if (p === "/api/stream") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        let last = Number(url.searchParams.get("after") ?? q.lastEventId());
        res.write(`event: hello\ndata: ${last}\n\n`);
        const t = setInterval(() => {
          const rows = q.eventsAfter(last);
          for (const e of rows) { res.write(`data: ${JSON.stringify(e)}\n\n`); last = e.id; }
          if (!rows.length) res.write(": keep-alive\n\n");
        }, 1000);
        req.on("close", () => clearInterval(t));
        return;
      }
      if (p.startsWith("/library/")) return file(req, res, LIBRARY, p.slice("/library/".length));
      if (p.startsWith("/web/")) return file(req, res, WEB, p.slice("/web/".length));
      return file(req, res, WEB, "index.html"); // the site routes in the browser
    } catch (e) { if (res.headersSent) res.destroy(); else send(res, { error: e.message }, 400); }
  });
  return new Promise((resolve) => server.listen(port, host, () => {
    // The port goes in the pulse, so `lessons request` can print a link that works.
    const beat = () => q.beat("site", { port: server.address().port });
    beat(); const t = setInterval(beat, BEAT); server.on("close", () => clearInterval(t));
    resolve(server);
  }));
}
