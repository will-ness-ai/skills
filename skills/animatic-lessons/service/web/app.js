// The site, routed in the browser: / (home), /course/<slug>, /watch/<course>/<lesson>,
// /queue, /queue/<id>. One event stream keeps the queue views live.
const main = document.getElementById("main"), side = document.getElementById("side");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const md = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const clock = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`);
const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const api = (p, o) => fetch(p, o).then((r) => r.json());
let view = null; // the open view's own hooks: { event(e), tick() }
let query = "";

const thumb = (l) => `<span class="thumb">${l.poster ? `<img src="${esc(l.poster)}" alt="" loading="lazy">` : ""}${l.video ? `<span class="dur">${clock(l.seconds)}</span>` : `<span class="making">being made</span>`}</span>`;
const card = (l, n) => `<a class="card" href="/watch/${l.course}/${l.slug}" data-link>${thumb(l)}<h3>${esc(l.title)}</h3><p>${md(l.lede)}</p><div class="n">Lesson ${n}</div></a>`;

async function nav() {
  const [courses, { requests }] = await Promise.all([api("/api/courses"), api("/api/requests")]);
  const live = requests.filter((r) => r.status === "working").length, waiting = requests.filter((r) => r.status === "queued").length;
  const p = location.pathname;
  side.innerHTML = `<a href="/" data-link class="${p === "/" ? "on" : ""}">Home</a>
    <a href="/queue" data-link class="${p.startsWith("/queue") ? "on" : ""}">Queue${live ? `<span class="badge live">${live} live</span>` : waiting ? `<span class="badge">${waiting}</span>` : ""}</a>
    <h3>Courses</h3>${courses.map((c) => `<a href="/course/${c.slug}" data-link class="${p === `/course/${c.slug}` || p.startsWith(`/watch/${c.slug}/`) ? "on" : ""}">${esc(c.title)}</a>`).join("") || `<a>None yet</a>`}`;
}

async function home(only) {
  let courses = await api("/api/courses");
  if (only) courses = courses.filter((c) => c.slug === only);
  const hit = (l) => !query || `${l.title} ${l.lede}`.toLowerCase().includes(query);
  const shelves = courses.map((c) => ({ c, ls: c.lessons.map((l, i) => [l, i + 1]).filter(([l]) => hit(l)) })).filter((s) => s.ls.length);
  main.innerHTML = shelves.length
    ? shelves.map(({ c, ls }) => `<div class="shelf-head"><h2><a href="/course/${c.slug}" data-link>${esc(c.title)}</a></h2><span>${c.lessons.length} lesson${c.lessons.length === 1 ? "" : "s"}</span></div>${only && c.about ? `<p class="sub">${md(c.about)}</p>` : ""}<div class="grid">${ls.map(([l, n]) => card(l, n)).join("")}</div>`).join("")
    : `<div class="empty"><h1>${query ? "No lessons match" : "No lessons yet"}</h1><p>${query ? "Try fewer words." : "Request one with the button above, or have an agent run <code>lessons request \"…\"</code>."}</p></div>`;
  view = { event: (e) => ["done", "lesson"].includes(e.kind) && home(only) };
}

async function watch(course, slug) {
  const l = await api(`/api/courses/${course}/lessons/${slug}`);
  const n = l.siblings.findIndex((s) => s.slug === slug) + 1;
  main.innerHTML = `<div class="watch"><div>
    ${l.video ? `<video controls autoplay src="${esc(l.video)}" poster="${esc(l.poster ?? "")}">${l.captions ? `<track kind="captions" src="${esc(l.captions)}" srclang="en" label="English">` : ""}</video>` : `<div class="box">This lesson is still being made. <a href="/queue" data-link>See the queue.</a></div>`}
    <h1>${esc(l.title)}</h1>
    <div class="meta"><a href="/course/${course}" data-link>${esc(l.courseTitle ?? course)}</a> · Lesson ${n} of ${l.siblings.length}${l.seconds ? ` · ${clock(l.seconds)}` : ""}</div>
    ${l.pretest ? `<div class="box guess"><h4>Guess first, before you press play</h4><p>${md(l.pretest)}</p><details><summary>Was your guess right?</summary><p>${md(l.pretestAnswer)}</p></details></div>` : ""}
    <div class="box"><p>${md(l.lede)}</p>${l.remember ? `<p><b>The one thing to remember.</b> ${md(l.remember)}</p>` : ""}</div>
    ${l.questions?.length ? `<div class="box"><h4>Practice: answer from memory, then open</h4>${l.questions.map((q, i) => `<details><summary>${i + 1}. ${md(q.q)}</summary><p>${md(q.a)}</p></details>`).join("")}</div>` : ""}
    ${l.sources?.length ? `<div class="box sources"><h4>Sources</h4>${l.sources.map((s, i) => `<p>${i ? "" : "Read next: "}<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></p>`).join("")}${l.note ? `<p class="ctx">${md(l.note)}</p>` : ""}</div>` : ""}
    <div class="box"><h4>Transcript</h4><ol class="transcript">${l.transcript.map((t, i) => `<li data-t="${t.start ?? ""}" data-i="${i}"><span class="t">${clock(t.start)}</span><span>${md(t.text)}</span></li>`).join("")}</ol></div>
  </div><aside class="next"><h3>${esc(l.courseTitle ?? course)}</h3>${l.siblings.map((s, i) => `<a class="mini ${s.slug === slug ? "on" : ""}" href="/watch/${course}/${s.slug}" data-link>${thumb(s)}<div><b>${esc(s.title)}</b><span>Lesson ${i + 1}</span></div></a>`).join("")}</aside></div>`;
  const video = main.querySelector("video"), rows = [...main.querySelectorAll(".transcript li")];
  rows.forEach((li) => li.addEventListener("click", () => { if (video && li.dataset.t) { video.currentTime = Number(li.dataset.t); video.play(); } }));
  video?.addEventListener("timeupdate", () => { let now = -1; rows.forEach((li, i) => { if (li.dataset.t && Number(li.dataset.t) <= video.currentTime + 0.05) now = i; }); rows.forEach((li, i) => li.classList.toggle("now", i === now)); });
  const next = l.siblings[n];
  video?.addEventListener("ended", () => { if (next?.video) go(`/watch/${course}/${next.slug}`); });
  view = {};
}

const steps = (r, stages, labels = false) => {
  const at = stages.indexOf(r.stage);
  const bar = `<div class="steps ${r.status === "done" ? "done" : ""}">${stages.map((s, i) => `<i class="${r.status === "working" && i === at ? "now" : i < at ? "past" : ""}" title="${s}"></i>`).join("")}</div>`;
  return labels ? `${bar}<div class="steplabels">${stages.map((s, i) => `<span class="${r.status === "working" && i === at ? "now" : ""}">${s}</span>`).join("")}</div>` : bar;
};
const req = (r, stages) => `<a class="req" href="/queue/${r.id}" data-link><div class="line"><span class="pill ${r.status}">${r.status === "working" ? r.stage ?? "working" : r.status}</span><span class="text">${esc(r.request)}</span><span class="when">${ago(r.finished_at ?? r.claimed_at ?? r.created_at)}</span></div>${r.status === "working" ? steps(r, stages) : ""}${r.note || r.summary ? `<div class="note">${esc(r.status === "working" ? r.note : r.summary ?? r.note)}</div>` : ""}</a>`;

async function queue() {
  const { requests, stages } = await api("/api/requests");
  const group = (title, status, hint) => { const rs = requests.filter((r) => status.includes(r.status)); return `<h2>${title} <span class="when">${rs.length}</span></h2>${rs.map((r) => req(r, stages)).join("") || `<p class="sub">${hint}</p>`}`; };
  main.innerHTML = `<h1>Queue</h1><p class="sub">Requests from agents and from you. One agent works one request at a time.</p>
    ${group("Working now", ["working"], "Nothing is being made right now.")}${group("Waiting", ["queued"], "Nothing is waiting.")}${group("Finished", ["done", "failed"], "Nothing has finished yet.")}`;
  view = { event: () => queue() };
}

async function request(id) {
  const eline = (e) => `<div class="e ${e.kind}"><time>${hhmm(e.ts)}</time>${e.kind === "say" || e.kind === "log" ? md(e.text) : e.kind === "tool" ? esc(e.text) : `${e.kind}${e.text ? ` · ${esc(e.text)}` : ""}`}</div>`;
  const draw = async (first) => {
    const r = await api(`/api/requests/${id}`);
    if (r.error) { main.innerHTML = `<div class="empty"><h1>No request ${esc(id)}</h1></div>`; return null; }
    if (first) {
      main.innerHTML = `<div id="head"></div><div class="livegrid"><div><h2 style="margin-top:0">The agent, live</h2><div class="feed" id="feed"></div></div><div class="assets" id="assets"></div></div>`;
      const feed = document.getElementById("feed");
      feed.innerHTML = r.events.map(eline).join("") || `<div class="e log">Waiting for a worker to pick this up.</div>`;
      feed.scrollTop = feed.scrollHeight;
    }
    document.getElementById("head").innerHTML = `<div class="line" style="display:flex;gap:10px;align-items:center"><span class="pill ${r.status}">${r.status}</span><span class="when">request ${r.id} · asked ${ago(r.created_at)}${r.course ? ` · course: <a href="/course/${r.course}" data-link>${esc(r.course)}</a>` : ""}</span></div>
      <h1 style="margin-top:8px">${esc(r.request)}</h1>${r.summary ? `<p class="sub">${md(r.summary)}</p>` : ""}${steps(r, r.stages, true)}
      ${r.transcript_path ? `<div class="ctx">Context: ${esc(r.transcript_path)}${r.message_id ? ` · message ${esc(r.message_id)}` : ""}</div>` : ""}`;
    document.getElementById("assets").innerHTML = r.lessons.length
      ? r.lessons.map((l) => `<h3>${l.video ? `<a href="/watch/${l.course}/${l.slug}" data-link>▶ ${esc(l.title)}</a>` : esc(l.title)} <span class="when">${l.video ? clock(l.seconds) : l.frames.length ? `${l.frames.length} frames so far` : l.transcript.length ? `${l.transcript.length} moments written` : "started"}</span></h3>
          ${l.frames.length ? `<div class="frames">${l.frames.map((f) => `<a href="${esc(f.url)}" target="_blank"><img src="${esc(f.url)}" alt="frame ${f.n}" loading="lazy"><b>${f.n}</b></a>`).join("")}</div>` : l.transcript.length ? `<ol class="transcript" style="margin-bottom:20px">${l.transcript.map((t) => `<li><span>${md(t.text)}</span></li>`).join("")}</ol>` : `<p class="sub">No storyboard yet.</p>`}`).join("")
      : `<h3>Lessons</h3><p class="sub">The lessons appear here as the agent starts them: the script first, then each frame as it is drawn, then the video.</p>`;
    return r;
  };
  let r = await draw(true), dirty = false;
  view = {
    event(e) {
      if (e.request_id !== Number(id)) return;
      const feed = document.getElementById("feed"), stick = feed.scrollTop + feed.clientHeight > feed.scrollHeight - 60;
      feed.insertAdjacentHTML("beforeend", eline(e));
      if (stick) feed.scrollTop = feed.scrollHeight;
      dirty = true;
    },
    // Frames land on disk without an event, so a working request is re-read on a timer.
    async tick() { if (dirty || r?.status === "working") { dirty = false; r = await draw(false); } },
  };
}

async function route() {
  view = null;
  const p = location.pathname.split("/").filter(Boolean);
  if (p[0] === "watch" && p[2]) await watch(p[1], p[2]);
  else if (p[0] === "course" && p[1]) await home(p[1]);
  else if (p[0] === "queue" && p[1]) await request(p[1]);
  else if (p[0] === "queue") await queue();
  else await home();
  nav();
  window.scrollTo(0, 0);
}
function go(href) { history.pushState(null, "", href); route(); }
document.addEventListener("click", (e) => { const a = e.target.closest("a[data-link]"); if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); go(a.getAttribute("href")); } });
window.addEventListener("popstate", route);
document.getElementById("search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); if (location.pathname !== "/") go("/"); else home(); });
document.getElementById("search").addEventListener("submit", (e) => e.preventDefault());
const dialog = document.getElementById("ask-dialog");
document.getElementById("ask").addEventListener("click", () => dialog.showModal());
dialog.addEventListener("close", async () => {
  const text = dialog.querySelector("textarea");
  if (dialog.returnValue === "send" && text.value.trim()) { const r = await api("/api/requests", { method: "POST", body: JSON.stringify({ request: text.value }) }); text.value = ""; go(`/queue/${r.id}`); }
});
new EventSource("/api/stream").onmessage = (m) => { const e = JSON.parse(m.data); view?.event?.(e); if (e.kind !== "say" && e.kind !== "tool") nav(); };
setInterval(() => view?.tick?.(), 3000);
route();
