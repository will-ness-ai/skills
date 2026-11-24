// build-with-me page. Draws the store's state; in live mode (bwm serve) it polls for changes
// and Submit posts to the agent; in a rendered file, Submit copies a reply to paste into chat.
(() => {
const LIVE = !window.BWM_STATE;
let S = window.BWM_STATE || null;
const PH = [["understand","Understand"],["decide","Decide"],["prove","Prove"],["ship","Ship"],["watch","Watch"]];
const OWNER = {answer:"you",check:"you",working:"claude",failed:"claude",waiting:null,expected:null,done:null};
const SHORT = {answer:"Your answer",check:"Your check",working:"In progress",failed:"Failed",waiting:"Waiting",expected:"Planned",done:"Done"};
const KINDS = [["golden","Golden path"],["edge","Edge cases"],["error","Errors"],["hardening","Hardening"]];
const app = document.getElementById("app"), sheet = document.getElementById("sheet"), sheetb = document.getElementById("sheetb"), scrim = document.getElementById("scrim"), modal = document.getElementById("modal");
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
let view = "board", qAt = 0, proofSel = null, openDone = {}, drafts = {}, sent = false, band = true, localSeen = new Set();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
// Every SVG the agent supplies (card diagrams, the goal picture) passes through here: scripts, foreign
// content, event handlers and outside links are dropped. Returns null when it isn't an SVG.
const cleanSvg = (src) => {
  const doc = new DOMParser().parseFromString(src, "image/svg+xml"), svg = doc.documentElement;
  if (svg.nodeName !== "svg" || doc.querySelector("parsererror")) return null;
  svg.querySelectorAll("script,style,foreignObject,iframe,object,embed,animate,set,animateMotion,animateTransform").forEach((n) => n.remove());
  for (const n of [svg, ...svg.querySelectorAll("*")]) for (const a of [...n.attributes]) if (/^on/i.test(a.name) || (/href$/i.test(a.name) && !/^#/.test(a.value)) || (a.name === "style" && /url\s*\(/i.test(a.value))) n.removeAttribute(a.name);
  svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("role", "img");
  return svg;
};
const diagram = (src) => { const svg = cleanSvg(src); return svg ? `<figure class="dia">${svg.outerHTML}</figure>` : `<pre>${esc(src)}</pre>`; };
const md = (s) => { const out = []; let list = null, code = null;
  for (const line of String(s ?? "").split("\n")) {
    if (line.startsWith("```")) { if (code) { out.push(code.svg ? diagram(code.join("\n")) : `<pre>${esc(code.join("\n"))}</pre>`); code = null; } else { code = []; code.svg = /^```svg\s*$/.test(line); } continue; }
    if (code) { code.push(line); continue; }
    const m = line.match(/^\s*[-*] (.*)/);
    if (m) { (list ??= []).push(`<li>${inline(m[1])}</li>`); continue; }
    if (list) { out.push(`<ul class="bul">${list.join("")}</ul>`); list = null; }
    if (line.trim()) out.push(/^#+ /.test(line) ? `<h4>${inline(line.replace(/^#+ /, ""))}</h4>` : `<p>${inline(line)}</p>`);
  }
  if (list) out.push(`<ul class="bul">${list.join("")}</ul>`); if (code) out.push(`<pre>${esc(code.join("\n"))}</pre>`);
  return `<div class="md">${out.join("")}</div>`; };
const icon = (s, n = 14) => { const c = {answer:"var(--you)",check:"var(--you)",working:"var(--claude)",failed:"var(--bad)",waiting:"var(--idle)",expected:"var(--idle)",done:"var(--ok)",open:"var(--you)"}[s] || "var(--idle)";
  const svg = (b) => `<svg class="si" width="${n}" height="${n}" viewBox="0 0 14 14" aria-hidden="true">${b}</svg>`;
  if (s === "done") return svg(`<circle cx="7" cy="7" r="7" fill="${c}"/><path d="M4 7.2l2 2 4-4.2" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  if (s === "failed") return svg(`<circle cx="7" cy="7" r="7" fill="${c}"/><path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`);
  if (s === "working") return svg(`<circle cx="7" cy="7" r="6" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M7 1a6 6 0 0 1 0 12z" fill="${c}"/>`);
  if (s === "answer" || s === "check" || s === "open") return svg(`<circle cx="7" cy="7" r="7" fill="${c}"/><text x="7" y="10.4" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff" font-family="Inter,sans-serif">?</text>`);
  if (s === "expected") return svg(`<circle cx="7" cy="7" r="6" fill="none" stroke="${c}" stroke-width="1.4"/><path d="M4.5 7h5" stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`);
  return svg(`<circle cx="7" cy="7" r="6" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="2.2 2"/>`); };
const av = (o) => `<span class="av ${o}">${o === "you" ? "Y" : "✳"}</span>`;
const ago = (t) => { const d = new Date(t), time = d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], {month:"short", day:"numeric"})}, ${time}`; };
const card = (id) => S.cards.find((c) => c.id === Number(id));
const isSeen = (c) => c.seen_at || localSeen.has(c.id);
const fresh = (c) => c.status === "done" && !isSeen(c);
const needs = () => S.cards.filter((c) => OWNER[c.status] === "you");
const answered = (c) => { const d = drafts[c.id]; if (!d) return false; return c.kind === "proof" || (c.kind === "note" && c.status === "check") ? !!d.verdict : !!(d.pick || d.take || d.unsure || d.prototype || d.bakeoff); };

// ---- seen ----
function markSeen(ids) {
  ids = ids.filter((id) => { const c = card(id); return c && c.status === "done" && !isSeen(c); });
  if (!ids.length) return;
  ids.forEach((id) => localSeen.add(id)); ls.set(`bwm-seen-${S.goal.id}`, [...localSeen]);
  if (LIVE) fetch("api/seen", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ids})}).catch(() => {});
}

// ---- top + band ----
function top() {
  const n = needs().length, done = needs().filter(answered).length;
  return `<div class="bar"><div class="crumbs"><span class="logo">B</span><span>build with me</span><span>/</span><b>${esc(S.goal.title)}</b></div><div class="barr"><span class="meta">Updated ${ago(S.goal.updated_at)}${LIVE ? "" : " · snapshot"}</span>${n ? `<button class="btn" data-submit ${done ? "" : "disabled"}>${sent ? "Sent ✓" : `Submit ${done}/${n}`}</button>` : ""}<span class="toast" id="toast">${sent && !n ? "Sent to Claude ✓" : ""}</span></div></div><h1>${esc(S.goal.title)}</h1>`;
}
function stand() {
  const d = S.decisions, p = S.cards.filter((c) => c.kind === "proof"), ship = S.cards.filter((c) => c.phase === "ship" && c.status !== "done")[0];
  return `<div class="stand"><span><b>${d.filter((x) => x.status === "settled").length} of ${d.length}</b> decided</span><span><b>${p.filter((x) => x.status === "done").length} of ${p.length}</b> proven</span>${ship ? `<span><b>${esc(ship.title.split(" · ")[0])}</b> ${esc(SHORT[ship.status].toLowerCase())}</span>` : ""}</div>`;
}
function numbers() { const m = {}; let i = 0; for (const d of S.decisions) if (d.status === "settled") m[d.id] = ++i; return m; }
function decRow(d, N) {
  const lead = d.status === "next" ? icon("waiting") : `<span class="num ${d.status === "open" ? "open" : ""}">${d.status === "open" ? "?" : N[d.id]}</span>`;
  return `<button class="dec ${d.status}" data-dec="${d.id}">${lead}<span class="dt">${esc(d.text)}</span><span class="dw">${d.status === "open" ? '<b class="yt">Your turn</b>' : ""}</span><span class="arr">›</span></button>`;
}
function picture(N) {
  const g = S.goal; if (!g.picture) return "";
  const svg = cleanSvg(g.picture); if (!svg) return "";
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n)) || !vb[2] || !vb[3]) vb.length = 0;
  const pins = vb.length ? S.decisions.filter((d) => d.pin_x !== null && d.status !== "next").map((d) => `<button class="pin ${d.status}" style="left:${((d.pin_x - vb[0]) / vb[2] * 100).toFixed(2)}%;top:${((d.pin_y - vb[1]) / vb[3] * 100).toFixed(2)}%" data-dec="${d.id}" title="${esc(d.text)}">${d.status === "open" ? "?" : N[d.id]}</button>`).join("") : "";
  return `<div class="pic">${svg.outerHTML}${pins}</div>`;
}
function bandView() {
  const g = S.goal, n = needs().length, N = numbers();
  const head = `<button class="bandh" data-band aria-expanded="${band}"><span class="bandl">${icon("working")}<span><span class="lbl">${band ? "Design" : "Goal"}</span><b>${band ? "What we're building, and where it stands" : esc(g.goal)}</b></span></span>${stand()}<span class="chev">${band ? "▴" : "▾"}</span></button>`;
  if (!band) return `<section class="band">${head}${n ? `<div class="bandask">${icon("answer")}<span><b>${n} thing${n > 1 ? "s" : ""} need${n > 1 ? "" : "s"} you</b></span><button class="btn you" data-queue>Start review</button></div>` : ""}</section>`;
  const ask = g.ask ? `<div class="ask ${n ? "" : "calm"}">${icon(n ? "answer" : "working")}<div><span class="lbl">${n ? "What I need from you now" : "Where it stands"}</span><p>${esc(g.ask)}</p></div>${n ? `<button class="btn you" data-queue>Start review</button>` : ""}</div>` : "";
  const goal = `<div class="goal"><div><span class="lbl">The goal</span><p class="gt">${esc(g.goal)}</p>${g.why ? `<p class="gw">${esc(g.why)}</p>` : ""}</div>${S.done.length ? `<div><span class="lbl">Done when</span><ul class="dwl">${S.done.map((d) => `<li>${icon(d.state === "done" ? "done" : d.state === "working" ? "working" : "waiting", 12)}<span>${esc(d.text)}</span></li>`).join("")}</ul></div>` : ""}</div>`;
  const pic = picture(N);
  const pair = g.today.length || g.after.length || pic ? `<div class="stack"><div class="pair">${g.today.length ? `<div class="bac"><span class="lbl">Today</span><ul class="bul">${g.today.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}<div class="bac after"><span class="lbl">After this ships</span>${pic}${g.after.length ? `<ul class="bul">${g.after.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div></div>${pic ? `<p class="meta">Numbers match the decisions. Click one to see what I asked and what you said. Amber needs your answer.</p>` : ""}</div>` : "";
  const topics = [...new Set(S.decisions.map((d) => d.topic))];
  const decs = `<div class="decs"><h3>Decisions</h3>${S.decisions.length ? topics.map((t) => `<div class="dgroup"><h4>${esc(t)}</h4>${S.decisions.filter((d) => d.topic === t).map((d) => decRow(d, N)).join("")}</div>`).join("") : `<p class="meta">Nothing decided yet.</p>`}</div>`;
  return `<section class="band">${head}<div class="bandb">${ask}${goal}${pair ? `<div class="side">${pair}${decs}</div>` : decs}</div></section>`;
}

// ---- board ----
function kcard(c) {
  const o = OWNER[c.status], f = fresh(c);
  const head = o ? `<div class="kh ${o}">${av(o)}<b>${o === "you" ? "Your turn" : "Claude"}</b><span class="nt">${esc(c.note || "")}</span></div>` : "";
  return `<div class="kc ${o === "you" ? "need" : ""} ${c.status === "failed" ? "bad" : ""} ${f ? "fresh" : ""} ${c.status === "done" && !f ? "seen" : ""}">${head}<button class="kt" data-open="${c.id}">${o ? "" : icon(c.status)}<span>${esc(c.title)}</span></button><span class="km"><span>${SHORT[c.status]}</span>${!o && c.note && c.note.toLowerCase() !== SHORT[c.status].toLowerCase() ? `<span class="nt">· ${esc(c.note)}</span>` : ""}${c.status === "done" ? `<span>· ${ago(c.done_at || c.updated_at)}</span>` : ""}<span class="sp"></span>${f ? '<span class="bdot" title="New since you last looked"></span>' : ""}</span></div>`;
}
function column([p, label]) {
  const cs = S.cards.filter((c) => c.phase === p);
  const grp = (k, l, sts) => { const g = cs.filter((c) => sts.includes(c.status)); return g.length ? `<div class="grp ${k}">${k === "you" || k === "claude" ? icon(k === "you" ? "answer" : "working", 12) : icon("waiting", 12)}${l}<span class="n">${g.length}</span></div>${g.map(kcard).join("")}` : ""; };
  const done = cs.filter((c) => c.status === "done"), unseen = done.filter(fresh), isOpen = openDone[p];
  const dot = cs.some((c) => OWNER[c.status] === "you") ? "you" : cs.some((c) => OWNER[c.status] === "claude") ? "claude" : cs.length && done.length === cs.length ? "done" : "";
  const doneHtml = done.length ? `<button class="grp" data-tog="${p}">${isOpen ? "▾" : "▸"} ${icon("done", 12)} Done<span class="n">${done.length}</span><span class="sp"></span>${unseen.length ? `<span class="link" data-ack="${unseen.map((c) => c.id).join(",")}">Mark all seen</span>` : ""}</button>${(isOpen ? done : unseen).map(kcard).join("")}` : "";
  return `<div class="col"><div class="colh"><span class="ph ${dot}"></span>${label}<span class="n">${cs.length}</span></div>${grp("you", "Your turn", ["answer", "check"])}${grp("claude", "Claude", ["failed", "working"])}${grp("wait", "Waiting", ["waiting", "expected"])}${doneHtml}${cs.length ? "" : `<div class="empty">Nothing here yet</div>`}</div>`;
}
const board = () => `<div class="board">${PH.map(column).join("")}</div>`;

// ---- question + proof bodies ----
function question(c) {
  const b = c.body || {}, d = drafts[c.id] ||= {};
  const opts = (b.options || []).map((o, i) => { const [l, r] = o.split("|"); return `<label class="opt"><input type="radio" name="q${c.id}" value="${i + 1}" data-pick="${c.id}" ${String(d.pick) === String(i + 1) ? "checked" : ""}><span><b>${esc(l)}${b.rec === i + 1 ? '<span class="rec">My pick</span>' : ""}</b><small>${esc(r || "")}</small></span></label>`; }).join("");
  const flags = [["unsure", "Not sure yet.", "Teach me more before you ask again."], ["prototype", "Decide by prototype.", "Build it quickly and let me try it."], ["bakeoff", "Decide by bake-off.", "Build several options, test them, show me results."]];
  return `<div class="ph1"><div class="chips"><span class="stt you">${icon("answer")} Your answer</span>${b.topic ? `<span class="chip">${esc(b.topic)}</span>` : ""}</div><h2>${esc(c.title)}</h2></div>
  <div class="cols2"><div class="stack">${(b.know || []).length ? `<section class="sec"><h4>Know this first</h4><ul class="bul">${b.know.map((k) => `<li>${inline(k)}</li>`).join("")}</ul></section>` : ""}${b.shape ? `<section class="sec"><h4>What it looks like in code</h4><pre class="shape">${esc(b.shape)}</pre></section>` : ""}</div>
  <div class="stack">${opts ? `<section class="sec"><h4>Options</h4><div class="opts">${opts}</div></section>` : ""}${b.why || b.flips ? `<div class="why">${b.why ? `<div><b>Why</b><span>${esc(b.why)}</span></div>` : ""}${b.flips ? `<div><b>Flips if</b><span>${esc(b.flips)}</span></div>` : ""}</div>` : ""}
  <section class="sec"><h4>Your take</h4><textarea data-take="${c.id}" placeholder="Optional. Anything I should know.">${esc(d.take || "")}</textarea></section>
  <div class="stack" style="gap:8px">${flags.map(([k, l, s]) => `<label class="chk"><input type="checkbox" data-flag="${k}" data-card="${c.id}" ${d[k] ? "checked" : ""}><span><b>${l}</b> ${s}</span></label>`).join("")}</div></div></div>`;
}
// A note card on the human's turn: its text, then a verdict (for a check) or a reply box.
function noteAsk(c) {
  const d = drafts[c.id] ||= {}, check = c.status === "check";
  const verdict = check ? `<section class="vbox"><h4>Your check</h4><div class="seg">${[["ok", "Looks right"], ["off", "Something's off"]].map(([v, l]) => `<button data-verdict="${v}" data-card="${c.id}" class="${v}" aria-pressed="${d.verdict === v}">${l}</button>`).join("")}</div>${d.verdict === "off" ? `<textarea data-comment="${c.id}" placeholder="What looks wrong?">${esc(d.comment || "")}</textarea>` : ""}</section>`
    : `<section class="sec"><h4>Your answer</h4><textarea data-take="${c.id}" placeholder="Your answer">${esc(d.take || "")}</textarea></section>`;
  return `<div class="ph1"><div class="chips"><span class="stt you">${icon(c.status)} ${check ? "Your check" : "Your answer"}</span></div><h2>${esc(c.title)}</h2></div>${c.body ? md(c.body) : ""}${verdict}`;
}
function evidence(s) {
  if (s.src && /^(data:image|.*\.(png|jpe?g|gif|webp|svg)$)/i.test(s.src + (s.evidence || ""))) return `<figure class="ev evbox"><img src="${esc(s.src)}" alt="${esc(s.did)}" loading="lazy"><figcaption>${esc(s.did)}</figcaption></figure>`;
  if (s.src && /^(data:video|.*\.(mp4|webm|mov)$)/i.test(s.src + (s.evidence || ""))) return `<figure class="ev evbox"><video src="${esc(s.src)}" controls preload="metadata"></video><figcaption>${esc(s.did)}</figcaption></figure>`;
  if (s.term) return `<figure class="ev"><pre class="term">${esc(s.term)}</pre><figcaption>${esc(s.did)}</figcaption></figure>`;
  if (s.evidence) return `<figure class="ev"><p class="meta">Evidence file: <code>${esc(s.evidence)}</code></p></figure>`;
  return "";
}
function proofBody(c, withBack) {
  const b = c.body || {}, steps = (c.steps || []).filter((s) => s.role === "step"), ctl = (c.steps || []).filter((s) => s.role === "control"), d = drafts[c.id] ||= {};
  const k = KINDS.find(([x]) => x === b.kind) || ["", b.kind];
  const st = c.status === "check" ? `<span class="stt you">${icon("check")} Your check</span>` : `<span class="stt">${icon(c.status)} ${c.status === "done" ? `Proven · ${ago(c.done_at || c.updated_at)}` : SHORT[c.status]}</span>`;
  const verdict = c.status === "check" ? `<section class="vbox"><h4>Your check</h4><div class="seg">${[["ok", "Looks right"], ["off", "Something's off"]].map(([v, l]) => `<button data-verdict="${v}" data-card="${c.id}" class="${v}" aria-pressed="${d.verdict === v}">${l}</button>`).join("")}</div>${d.verdict === "off" ? `<textarea data-comment="${c.id}" placeholder="What looks wrong? I'll re-run and send new evidence.">${esc(d.comment || "")}</textarea>` : ""}</section>` : "";
  const media = [...steps, ...ctl].map(evidence).filter(Boolean).join("");
  return `<div class="ph1">${withBack ? `<button class="link" data-board>← Board</button>` : ""}<div class="chips"><span class="chip ${esc(b.kind)}">${esc(k[1])}</span>${st}</div><h2>${esc(c.title)}</h2>${b.claim ? `<p class="claim">${esc(b.claim)}</p>` : ""}</div>
  <div class="cols2"><div class="stack">${(b.setup || []).length ? `<section class="sec"><h4>Setup</h4><ul class="bul">${b.setup.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}
  <section class="sec"><h4>Steps</h4>${steps.length ? `<ol class="steps">${steps.map((s) => `<li>${icon(c.status === "failed" ? "failed" : c.status === "expected" ? "expected" : "done", 14)}<div><b>${esc(s.did)}</b><span class="ea">${s.expected ? `<span>Expected: ${esc(s.expected)}</span>` : ""}${s.got ? `<span>Got: ${esc(s.got)}</span>` : ""}</span></div></li>`).join("")}</ol>` : `<p class="meta">No steps yet.</p>`}</section>
  ${ctl.map((s) => `<div class="ctl"><b>${esc(s.did)}.</b> ${s.expected ? `Expected: ${esc(s.expected)}.` : ""} ${s.got ? `Got: ${esc(s.got)}.` : ""} This shows the test can tell pass from fail.</div>`).join("")}
  ${b.try ? `<details class="try"><summary>Try it yourself</summary><p>${esc(b.try)}</p></details>` : ""}${verdict}</div>
  <div class="stack">${media || `<p class="meta">No evidence attached yet.</p>`}</div></div>`;
}

// ---- views ----
function queueView() {
  const ns = needs(); if (!ns.length) { view = "board"; return main(); }
  qAt = Math.min(qAt, ns.length - 1); const c = ns[qAt];
  return `<div class="panel"><div class="qtop"><button class="btn" data-board>← Board</button><div class="qprog">${ns.map((x, i) => `<span class="${answered(x) ? "d" : i === qAt ? "c" : ""}"></span>`).join("")}</div><span class="meta">${qAt + 1} of ${ns.length}</span></div>${c.kind === "proof" ? proofBody(c) : c.kind === "question" ? question(c) : noteAsk(c)}<div class="pfoot"><button class="btn" data-qprev ${qAt ? "" : "disabled"}>Back</button><span class="sp"></span>${qAt < ns.length - 1 ? `<button class="btn pri" data-qnext>Next →</button>` : `<button class="btn pri" data-submit ${ns.some(answered) ? "" : "disabled"}>${sent ? "Sent ✓" : "Submit to Claude"}</button>`}</div></div>`;
}
function proofsView() {
  const ps = S.cards.filter((c) => c.kind === "proof"); const sel = card(proofSel) || ps[0];
  const cov = `<div class="cov">${KINDS.map(([k, l]) => { const g = ps.filter((c) => c.body?.kind === k); return `<div class="covc"><h4>${l}</h4>${g.map((c) => `<button class="covr ${c.status} ${sel && c.id === sel.id ? "on" : ""}" data-proof="${c.id}">${icon(c.status)}<span>${esc(c.title)}</span></button>`).join("") || `<span class="gap">Nothing proven here yet</span>`}</div>`; }).join("")}</div>`;
  return `<div class="panel"><div class="qtop"><button class="btn" data-board>← Board</button><span class="meta">Proof for this goal, by kind</span></div>${cov}${sel ? `<div style="border-top:1px solid var(--line);padding-top:16px;display:flex;flex-direction:column;gap:16px">${proofBody(sel)}</div>` : ""}${sel && sel.status === "check" ? `<div class="pfoot"><span class="sp"></span><button class="btn pri" data-submit ${answered(sel) ? "" : "disabled"}>${sent ? "Sent ✓" : "Submit to Claude"}</button></div>` : ""}</div>`;
}
function main() { return top() + (view === "queue" ? queueView() : view === "proofs" ? proofsView() : bandView() + board()); }
function render() {
  if (!S) { app.innerHTML = `<p class="meta">No goal yet. Ask Claude to start one.</p>`; return; }
  const y = scrollY; app.innerHTML = main(); scrollTo(0, y);
}

// ---- sheet ----
function sheetOpen(title, html) { document.getElementById("sheett").textContent = title; sheetb.innerHTML = html; sheet.hidden = false; scrim.hidden = false; }
function close() { sheet.hidden = true; scrim.hidden = true; modal.hidden = true; render(); }
function decSheet(id) {
  const d = S.decisions.find((x) => x.id === Number(id)); if (!d) return;
  if (d.status === "open" && d.card_id && card(d.card_id) && OWNER[card(d.card_id).status] === "you") { view = "queue"; qAt = needs().findIndex((c) => c.id === d.card_id); render(); scrollTo(0, 0); return; }
  sheetOpen(d.status === "settled" ? "Decided" : d.status === "open" ? "Open" : "Coming next", `<span class="meta">${esc(d.topic)}</span><h2>${esc(d.text)}</h2>${d.asked ? `<section class="sec"><h4>What I asked</h4><p class="qq">${esc(d.asked)}</p></section>` : ""}${d.answer ? `<section class="sec"><h4>Your answer</h4><blockquote class="ans">${esc(d.answer)}</blockquote></section>` : ""}${d.why ? `<section class="sec"><h4>Why</h4><p class="qq">${esc(d.why)}</p></section>` : ""}${d.status === "next" ? `<p class="qq">I'll ask this once the open questions are answered.</p>` : ""}<p class="meta">Want to change it? Say so in the chat and I'll reopen it.</p>`);
}
function openCard(id) {
  const c = card(id); if (!c) return;
  if (OWNER[c.status] === "you") { view = "queue"; qAt = needs().findIndex((x) => x.id === c.id); render(); scrollTo(0, 0); return; }
  markSeen([c.id]);
  if (c.kind === "proof") { view = "proofs"; proofSel = c.id; render(); scrollTo(0, 0); return; }
  const b = c.kind === "question" ? `<p class="meta">${esc(c.body?.topic || "")}</p>` : c.body ? md(c.body) : "";
  sheetOpen(PH.find(([p]) => p === c.phase)[1], `<div class="chips"><span class="stt">${icon(c.status)} ${SHORT[c.status]}${c.note ? ` · ${esc(c.note)}` : ""}</span></div><h2>${esc(c.title)}</h2>${b}<p class="meta">Updated ${ago(c.updated_at)}</p>`);
}

// ---- submit ----
function payload() {
  const answers = {};
  for (const c of needs()) if (answered(c)) answers[c.id] = drafts[c.id];
  return { answers, seen: LIVE ? [] : [...localSeen] };
}
async function submit() {
  const p = payload(); if (!Object.keys(p.answers).length) return;
  if (LIVE) {
    const r = await fetch("api/submit", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(p)}).catch(() => null);
    const t = document.getElementById("toast");
    if (r && r.ok) { sent = true; drafts = {}; if (t) t.textContent = "Sent to Claude"; setTimeout(poll, 400); }
    else if (t) { t.style.color = "var(--bad)"; t.textContent = "Couldn't reach Claude's page server. Is bwm serve still running?"; }
    render(); return;
  }
  document.getElementById("reply").value = BWMReply.encode(p.answers, Object.fromEntries(Object.keys(p.answers).map((id) => [id, card(Number(id))?.title])), p.seen);
  modal.hidden = false;
}

// ---- events ----
document.addEventListener("click", (e) => {
  const t = e.target.closest("button,[data-ack]"); if (!t) return;
  if (t.dataset.ack !== undefined && t.matches("[data-ack]")) { e.stopPropagation(); markSeen(t.dataset.ack.split(",").map(Number)); render(); return; }
  if (t.hasAttribute("data-close")) return close();
  if (t.hasAttribute("data-band")) { band = !band; ls.set("bwm-band", band); render(); return; }
  if (t.hasAttribute("data-queue")) { view = "queue"; qAt = 0; render(); scrollTo(0, 0); return; }
  if (t.hasAttribute("data-board")) { view = "board"; render(); return; }
  if (t.hasAttribute("data-qnext")) { qAt++; render(); scrollTo(0, 0); return; }
  if (t.hasAttribute("data-qprev")) { qAt = Math.max(0, qAt - 1); render(); scrollTo(0, 0); return; }
  if (t.hasAttribute("data-submit")) return submit();
  if (t.dataset.tog) { const p = t.dataset.tog; if (openDone[p]) { openDone[p] = false; markSeen(S.cards.filter((c) => c.phase === p && c.status === "done").map((c) => c.id)); } else openDone[p] = true; render(); return; }
  if (t.dataset.open) return openCard(t.dataset.open);
  if (t.dataset.dec) return decSheet(t.dataset.dec);
  if (t.dataset.proof) { proofSel = Number(t.dataset.proof); markSeen([proofSel]); render(); return; }
  if (t.dataset.verdict) { const d = drafts[t.dataset.card] ||= {}; d.verdict = t.dataset.verdict; sent = false; render(); return; }
  if (t.id === "copy") { const r = document.getElementById("reply"); r.select(); navigator.clipboard?.writeText(r.value).then(() => { t.textContent = "Copied ✓"; }, () => { document.execCommand?.("copy"); t.textContent = "Copied ✓"; }); }
});
document.addEventListener("input", (e) => {
  const t = e.target, D = (id) => (drafts[id] ||= {});
  if (t.dataset.pick) D(t.dataset.pick).pick = t.value;
  else if (t.dataset.take) D(t.dataset.take).take = t.value;
  else if (t.dataset.comment) D(t.dataset.comment).comment = t.value;
  else if (t.dataset.flag) D(t.dataset.card)[t.dataset.flag] = t.checked;
  else return;
  sent = false;
  document.querySelectorAll("[data-submit]").forEach((b) => { b.disabled = !needs().some(answered); if (b.closest(".bar")) b.textContent = `Submit ${needs().filter(answered).length}/${needs().length}`; });
  document.querySelectorAll(".qprog span").forEach((s, i) => { const c = needs()[i]; s.className = answered(c) ? "d" : i === qAt ? "c" : ""; });
});
document.addEventListener("mouseover", (e) => { const t = e.target.closest("[data-dec]"); document.querySelectorAll(".hl").forEach((x) => x.classList.remove("hl")); if (t) document.querySelectorAll(`[data-dec="${t.dataset.dec}"]`).forEach((x) => x.classList.add("hl")); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
scrim.onclick = close;

// ---- load + live updates ----
let sig = "";
async function poll() {
  try {
    const r = await fetch("api/state", {cache:"no-store"}); if (!r.ok) return;
    const next = await r.json(), s2 = JSON.stringify(next);
    if (s2 === sig) return;
    // Hold the new state back while the human types or a sheet is open; the next poll draws it.
    const busy = document.activeElement && ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName);
    if (busy || !sheet.hidden) return;
    sig = s2; S = next; render();
  } catch {}
}
band = ls.get("bwm-band", true);
if (S) { localSeen = new Set(ls.get(`bwm-seen-${S.goal.id}`, [])); render(); }
if (LIVE) { poll().then(() => { if (S) localSeen = new Set(ls.get(`bwm-seen-${S.goal.id}`, [])); render(); }); setInterval(poll, 3000); }
})();
