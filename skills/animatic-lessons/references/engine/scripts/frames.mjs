// Generated frames: a storyboard "frame" spec -> one HTML page on the kit.
// The spec carries the content; this file carries the markup, the real line
// numbers, the syntax colours and the one lit thing. See FRAMES.md.

import fs from "node:fs";
import path from "node:path";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lights = `<div class="lights"><i></i><i></i><i></i></div>`;
const TYPES = ["title", "code", "terminal", "diagram", "list", "page", "table", "split", "anatomy", "timeline", "console", "sequence", "guess", "agent", "tree", "stack"];

// Text a viewer reads that is not code: STYLE.md caps it at 50 characters.
const prose = (warns, where, s) => {
  if (String(s ?? "").length > 50) warns.push(`${where}: "${String(s).slice(0, 40)}..." is ${String(s).length} characters; the frame cap is 50`);
  return esc(s);
};

// 1-based index or matching text -> index into items, or -1.
const pick = (items, lit, text) => {
  if (lit === undefined || lit === null) return -1;
  if (typeof lit === "number") return lit - 1;
  return items.findIndex((it) => text(it).includes(String(lit)));
};
const hidden = (spec, i) => (spec.show !== undefined && i >= spec.show ? ` style="visibility:hidden"` : "");

// ---------------------------------------------------------------- code

// A unified diff (`git diff`, or a host's PR diff) -> rows for one file, numbered by
// the new file. A removed line sits at the number of the line after it.
const parseDiff = (text, file) => {
  const rows = [];
  let inFile = false;
  let n = 0;
  let hunk = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = line.match(/ b\/(.+)$/);
      inFile = !!m && (m[1] === file || m[1].endsWith("/" + file));
      continue;
    }
    if (!inFile) continue;
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      n = Number(h[1]);
      hunk++;
      continue;
    }
    if (!hunk || line.startsWith("\\")) continue;
    const c = line[0];
    if (c === "+") rows.push({ kind: "add", n: n++, text: line.slice(1), hunk });
    else if (c === "-") rows.push({ kind: "del", n: null, at: n, text: line.slice(1), hunk });
    else if (c === " " || line === "") rows.push({ kind: "ctx", n: n++, text: line.slice(1), hunk });
  }
  return rows;
};

// "12-30" | "12-30,44-50" | [[12,30],[44,50]] -> [[12,30],[44,50]]
const ranges = (r) => {
  if (r === undefined) return null;
  const list = Array.isArray(r) ? r : String(r).split(",");
  return list.map((x) => (Array.isArray(x) ? x : String(x).split("-").map(Number))).map(([a, b]) => [a, b ?? a]);
};

let highlighter;
const highlight = async (lines, lang, home) => {
  try {
    if (!highlighter) {
      const shiki = await import(path.join(home, "node_modules", "shiki", "dist", "index.mjs"));
      highlighter = await shiki.createHighlighter({ themes: ["vitesse-dark"], langs: [] });
    }
    try {
      await highlighter.loadLanguage(lang);
    } catch {
      lang = "text";
    }
    const { tokens } = highlighter.codeToTokens(lines.join("\n"), { lang, theme: "vitesse-dark" });
    return tokens.map((toks) =>
      toks.map((t) => `<span style="color:${t.color}${t.fontStyle & 1 ? ";font-style:italic" : ""}">${esc(t.content)}</span>`).join(""),
    );
  } catch {
    return lines.map(esc);
  }
};

const LANGS = { yml: "yaml", mjs: "js", cjs: "js", mts: "ts", cts: "ts", md: "markdown", sh: "bash", zsh: "bash", py: "python", rb: "ruby", rs: "rust" };

const code = async (spec, dir, home, warns, bare = false) => {
  if (!spec.path) throw new Error(`a code frame needs "path" (the file's path in the repo)`);
  let rows;
  if (spec.diff) {
    rows = parseDiff(fs.readFileSync(path.resolve(dir, spec.diff), "utf8"), spec.path);
    if (!rows.length) throw new Error(`no hunks for ${spec.path} in ${spec.diff}`);
  } else if (spec.src) {
    rows = fs.readFileSync(path.resolve(dir, spec.src), "utf8").replace(/\n$/, "").split("\n").map((text, i) => ({ kind: "ctx", n: i + 1, text }));
  } else throw new Error(`a code frame needs "diff" (a saved diff) or "src" (a saved copy of the file)`);
  const want = ranges(spec.lines);
  if (want) rows = rows.filter((r) => want.some(([a, b]) => (r.n ?? r.at) >= a && (r.n ?? r.at) <= b));
  if (!rows.length) throw new Error(`lines ${spec.lines} select nothing in ${spec.path}`);
  const ext = path.extname(spec.path).slice(1).toLowerCase();
  const html = await highlight(rows.map((r) => r.text), spec.lang ?? LANGS[ext] ?? (ext || "text"), home);
  const lit = spec.lit === undefined || spec.lit === null ? -1
    : typeof spec.lit === "number" ? rows.findIndex((r) => r.n === spec.lit)
    : rows.findIndex((r) => r.text.includes(String(spec.lit)));
  if (spec.lit !== undefined && spec.lit !== null && lit < 0) warns.push(`lit ${JSON.stringify(spec.lit)} is not a shown line of ${spec.path}`);
  const out = [];
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    // A gap in the numbering, or a new hunk, is a fold: the excerpt keeps real numbers.
    if (prev && (r.hunk !== prev.hunk || (r.n ?? r.at) - (prev.n ?? prev.at - 1) > 1)) out.push(`<span class="l fold" data-n=""> </span>`);
    const cls = ["l", r.kind === "add" ? "add" : r.kind === "del" ? "del" : "", i === lit ? "here" : ""].filter(Boolean).join(" ");
    out.push(`<span class="${cls}" data-n="${r.n ?? "−"}">${html[i] || " "}</span>`);
  });
  const tree = (spec.tree ?? []).map((p) => {
    const tag = p[0] === "+" ? " added" : p[0] === "~" ? " modified" : "";
    const name = tag ? p.slice(1) : p;
    return `<li class="${tag.trim()}${name === spec.path ? " active" : ""}">${esc(name)}</li>`;
  }).join("");
  const win = codeWindow(spec, tree, lit, out);
  return bare ? win : `<div class="frame frame--full">${win}</div>`;
};
const codeWindow = (spec, tree, lit, out) => {
  return `<div class="window">
<div class="titlebar">${lights}<span class="title">${esc(spec.title ?? spec.path)}</span></div>
<div class="panes">${tree ? `<nav class="sidebar"><div class="sidebar-heading">Explorer</div><ul class="tree">${tree}</ul></nav>` : ""}
<div class="main"><div class="tabs"><div class="tab active">${esc(path.basename(spec.path))}</div></div>
<div class="code gen${lit >= 0 ? " code--spotlight" : ""}" data-fit="rows">${out.join("")}</div></div></div></div>`;
};

// ---------------------------------------------------------------- the rest

const TONES = ["ok", "bad", "warn", "info", "faint", "cyan", "yellow", "magenta"];

const terminalWindow = (spec, warns) => {
  const lines = spec.lines ?? [];
  const text = (l) => (typeof l === "string" ? l : l.text ?? "");
  const lit = pick(lines, spec.lit, text);
  if (spec.lit !== undefined && spec.lit !== null && lit < 0) warns.push(`lit ${JSON.stringify(spec.lit)} is not a terminal line`);
  const rows = lines.map((l, i) => {
    const t = text(l);
    const tone = typeof l === "object" && TONES.includes(l.tone) ? ` ${l.tone}` : "";
    const here = i === lit ? " here" : "";
    if (t === "") return `<span class="blank${here}"${hidden(spec, i)}></span>`;
    if (t.startsWith("$ ")) return `<span class="cmd${here}"${hidden(spec, i)}>${esc(t.slice(2))}</span>`;
    return `<span class="out${tone}${here}"${hidden(spec, i)}>${esc(t)}</span>`;
  });
  return `<div class="window">
<div class="titlebar">${lights}<span class="title">${esc(spec.title ?? "Terminal")}</span></div>
<div class="terminal gen${lit >= 0 ? " spotlight" : ""}" data-fit="rows" data-trim="top">${rows.join("")}</div></div>`;
};

const title = (spec, warns) => `<div class="frame frame--center"><div class="gen-wrap" data-fit="scale"><div class="card">
${spec.kicker ? `<div class="kicker">${esc(spec.kicker)}</div>` : ""}
<h1 class="headline">${String(spec.headline ?? "").split("\n").map((l) => prose(warns, "headline", l)).join("<br>")}<span class="rule"></span></h1>
${spec.sub ? `<p class="subhead">${esc(spec.sub)}</p>` : ""}</div></div></div>`;

const diagram = (spec, warns) => {
  const nodes = (spec.nodes ?? []).map((n) => (typeof n === "string" ? { title: n } : n));
  const lit = pick(nodes, spec.lit, (n) => n.title ?? "");
  if (spec.lit !== undefined && spec.lit !== null && lit < 0) warns.push(`lit ${JSON.stringify(spec.lit)} is not a node`);
  const labels = spec.arrows === false ? null : spec.arrows ?? [];
  const parts = [];
  nodes.forEach((n, i) => {
    if (i && labels) parts.push(`<div class="arrow"${hidden(spec, i)}><span>&rarr;</span>${labels[i - 1] ? `<span class="label">${esc(labels[i - 1])}</span>` : ""}</div>`);
    const cls = i === lit ? " lit" : lit >= 0 ? " muted" : "";
    parts.push(`<div class="node${cls}"${hidden(spec, i)}><div class="node-title">${prose(warns, "node", n.title)}</div>${n.sub ? `<div class="node-sub">${prose(warns, "node sub", n.sub)}</div>` : ""}</div>`);
  });
  return `<div class="frame frame--center"><div class="gen-wrap" data-fit="scale">
${spec.title ? `<div class="overline">${prose(warns, "title", spec.title)}</div>` : ""}
<div class="diagram gen" style="margin-top:56px">${parts.join("")}</div>
${spec.note ? `<div class="annotation" style="margin-top:72px">${prose(warns, "note", spec.note)}</div>` : ""}</div></div>`;
};

const TAGS = { "+": "add", "~": "mod", "-": "del", added: "add", modified: "mod", removed: "del", deleted: "del" };
const list = (spec, warns) => {
  const items = (spec.items ?? []).map((it) => (typeof it === "string" ? { text: it } : it));
  const lit = pick(items, spec.lit, (it) => it.text ?? "");
  if (spec.lit !== undefined && spec.lit !== null && lit < 0) warns.push(`lit ${JSON.stringify(spec.lit)} is not an item`);
  const anyTag = items.some((it) => it.tag);
  const lis = items.map((it, i) => {
    const tag = anyTag ? `<span class="tag ${TAGS[it.tag] ?? ""}">${esc(it.tag && it.tag.length === 1 ? (it.tag === "-" ? "−" : it.tag) : it.tag ? { add: "+", mod: "~", del: "−" }[TAGS[it.tag]] : "")}</span>` : "";
    return `<li class="${i === lit ? "lit" : ""}"${hidden(spec, i)}>${tag}<span class="text">${prose(warns, "item", it.text)}</span>${it.sub ? `<span class="sub">${prose(warns, "item sub", it.sub)}</span>` : ""}</li>`;
  });
  return `<div class="frame frame--center"><div class="gen-wrap" data-fit="scale">
${spec.title ? `<div class="overline">${prose(warns, "title", spec.title)}</div>` : ""}
<ol class="biglist${spec.mono ? " mono" : ""}${lit >= 0 ? " spotlight" : ""}">${lis.join("")}</ol></div></div>`;
};

const terminal = (spec, warns) => `<div class="frame frame--inset">${terminalWindow(spec, warns)}</div>`;

// A light docs page. Paragraphs, "## " headings and `inline code`; lit is a
// phrase on the page, set in .spot.
const pageWindow = (spec, warns) => {
  let spotted = false;
  const inline = (s) => {
    let h = esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
    if (spec.lit && !spotted && h.includes(esc(spec.lit))) {
      h = h.replace(esc(spec.lit), `<span class="spot">${esc(spec.lit)}</span>`);
      spotted = true;
    }
    return h;
  };
  const body = (spec.body ?? []).map((p, i) => (p.startsWith("## ") ? `<h2${hidden(spec, i)}>${inline(p.slice(3))}</h2>` : `<p${hidden(spec, i)}>${inline(p)}</p>`)).join("");
  const h1 = inline(spec.heading ?? "");
  if (spec.lit && !spotted) warns.push(`lit ${JSON.stringify(spec.lit)} is not on the page`);
  const [host, ...rest] = String(spec.url ?? "").replace(/^https?:\/\//, "").split("/");
  return `<div class="window">
<div class="browserbar">${lights}<div class="nav-buttons"><span>&lsaquo;</span><span>&rsaquo;</span><span>&circlearrowright;</span></div>
<div class="urlbar"><span><span class="host">${esc(host)}</span>${rest.length ? "/" + esc(rest.join("/")) : ""}</span></div></div>
<div class="page" data-fit="rows" data-trim="bottom">${h1 ? `<h1>${h1}</h1>` : ""}${body}</div></div>`;
};
const page = (spec, warns) => `<div class="frame frame--full">${pageWindow(spec, warns)}</div>`;

// ---------------------------------------------------------------- more types
const given = (lit) => lit !== undefined && lit !== null;
const toneOf = (x) => (x && TONES.includes(x.tone) ? ` ${x.tone}` : "");
const overline = (spec, warns) => (spec.title ? `<div class="overline">${prose(warns, "title", spec.title)}</div>` : "");
const centred = (inner) => `<div class="frame frame--center"><div class="gen-wrap" data-fit="scale">${inner}</div></div>`;
const missed = (spec, warns, what) => warns.push(`lit ${JSON.stringify(spec.lit)} is not ${what}`);

// A table: a number lights a row, text lights the one cell containing it.
const table = (spec, warns) => {
  const cell = (c) => (c && typeof c === "object" ? c : { text: c ?? "" });
  const rows = (spec.rows ?? []).map((r) => r.map(cell));
  let row = -1;
  let col = -1;
  if (typeof spec.lit === "number") row = spec.lit - 1;
  else if (given(spec.lit))
    rows.some((r, i) => r.some((c, j) => String(c.text).includes(String(spec.lit)) && ((row = i), (col = j), true)));
  if (given(spec.lit) && !rows[row]) missed(spec, warns, "a row or a cell");
  const head = (spec.cols ?? []).length ? `<thead><tr>${spec.cols.map((c) => `<th>${prose(warns, "column", c)}</th>`).join("")}</tr></thead>` : "";
  const body = rows.map((r, i) => `<tr class="${i === row && col < 0 ? "lit" : ""}"${hidden(spec, i)}>${r
    .map((c, j) => `<td class="${toneOf(c).trim()}${i === row && j === col ? " lit" : ""}">${prose(warns, "cell", c.text)}${c.sub ? `<small>${prose(warns, "cell sub", c.sub)}</small>` : ""}</td>`)
    .join("")}</tr>`);
  return centred(`${overline(spec, warns)}<table class="gtable fitx${spec.mono ? " mono" : ""}${rows[row] ? " spotlight" : ""}">${head}<tbody>${body.join("")}</tbody></table>`);
};

// Two panes, one per machine. Each pane is a terminal, code or page spec;
// "show" counts terminal lines and page paragraphs across both, left first;
// "lit" is text (the first pane holding it) or [pane, lit].
const split = async (spec, dir, home, warns) => {
  const panes = spec.panes ?? [];
  if (panes.length !== 2) throw new Error(`a split frame needs two "panes"`);
  for (const p of panes) if (!["terminal", "code", "page"].includes(p.type)) throw new Error(`a split pane is a terminal, code or page, not "${p.type}"`);
  const items = (p) => (p.type === "terminal" ? (p.lines ?? []).length : p.type === "page" ? (p.body ?? []).length : 0);
  const draw = (p, lit, show, w) => (p.type === "code" ? code({ ...p, lit }, dir, home, w, true) : p.type === "terminal" ? terminalWindow({ ...p, lit, show }, w) : pageWindow({ ...p, lit, show }, w));
  let before = 0;
  const shows = panes.map((p) => {
    const n = items(p);
    const s = spec.show === undefined || !n ? undefined : Math.max(0, Math.min(n, spec.show - before));
    before += n;
    return s;
  });
  let at = -1;
  let lit;
  if (Array.isArray(spec.lit)) [at, lit] = [spec.lit[0] - 1, spec.lit[1]];
  else if (given(spec.lit)) {
    for (let i = 0; i < panes.length && at < 0; i++) {
      const w = [];
      await draw(panes[i], spec.lit, shows[i], w);
      if (!w.some((x) => x.startsWith("lit "))) [at, lit] = [i, spec.lit];
    }
    if (at < 0) missed(spec, warns, "in either pane");
  }
  const html = [];
  for (let i = 0; i < panes.length; i++)
    html.push(`<div class="gpane${at >= 0 && i !== at ? " muted" : ""}">${await draw(panes[i], i === at ? lit : undefined, shows[i], warns)}</div>`);
  return `<div class="frame frame--inset"><div class="gsplit">${html.join("")}</div></div>`;
};

// One string, its parts named. A string part is a separator; { text, label }
// is a named part. "show" is how many labels are up; "lit" a named part.
const anatomy = (spec, warns) => {
  const parts = (spec.parts ?? []).map((p) => (typeof p === "string" ? { text: p, sep: true } : p));
  const named = parts.filter((p) => !p.sep);
  const lit = pick(named, spec.lit, (p) => `${p.text} ${p.label ?? ""}`);
  if (given(spec.lit) && !named[lit]) missed(spec, warns, "a named part");
  let k = -1;
  const html = parts.map((p) => {
    if (p.sep) return `<span class="asep">${esc(p.text)}</span>`;
    k++;
    const hide = spec.show !== undefined && k >= spec.show ? ` style="visibility:hidden"` : "";
    return `<div class="apart${k === lit ? " lit" : ""}"><span class="atext">${esc(p.text)}</span><span class="abrace"${hide}></span><span class="alabel"${hide}>${prose(warns, "label", p.label ?? "")}</span></div>`;
  });
  return centred(`${overline(spec, warns)}<div class="anatomy fitx${named[lit] ? " spotlight" : ""}">${html.join("")}</div>${spec.note ? `<div class="annotation anote">${prose(warns, "note", spec.note).replace(/`([^`]+)`/g, "<code>$1</code>")}</div>` : ""}`);
};

// Events along time. { gap: true } breaks the axis (time skipped).
const timeline = (spec, warns) => {
  const all = spec.events ?? [];
  const events = all.filter((e) => !e.gap);
  const lit = pick(events, spec.lit, (e) => `${e.when ?? ""} ${e.what ?? ""}`);
  if (given(spec.lit) && !events[lit]) missed(spec, warns, "an event");
  let k = -1;
  const html = all.map((e) => {
    if (e.gap) return `<div class="tgap">&asymp;</div>`;
    k++;
    return `<div class="tev${toneOf(e)}${k === lit ? " lit" : ""}"${hidden(spec, k)}><div class="twhen">${prose(warns, "when", e.when ?? "")}</div><div class="tdot"></div><div class="twhat">${prose(warns, "what", e.what ?? "")}</div>${e.sub ? `<div class="tsub">${prose(warns, "sub", e.sub)}</div>` : ""}</div>`;
  });
  return centred(`${overline(spec, warns)}<div class="timeline fitx${events[lit] ? " spotlight" : ""}">${html.join("")}</div>`);
};

// A web app's own screen: nav, a heading, rows, a row menu. Light by default;
// a course's frames.css restyles it through the --console-* variables.
const consoleFrame = (spec, warns) => {
  const row = (r) => (Array.isArray(r) ? { cells: r } : r);
  const rows = (spec.rows ?? []).map(row);
  const menu = spec.menu ? { ...spec.menu, items: (spec.menu.items ?? []).map((x) => (typeof x === "string" ? { text: x } : x)) } : null;
  const has = (s) => String(s ?? "").includes(String(spec.lit));
  let lit = { kind: null, i: -1 };
  if (typeof spec.lit === "number") lit = { kind: "row", i: spec.lit - 1 };
  else if (given(spec.lit)) {
    const m = menu ? menu.items.findIndex((x) => x.text !== "-" && has(x.text)) : -1;
    const r = rows.findIndex((x) => [...(x.cells ?? []), x.sub, ...(x.chips ?? []).map((c) => c.text ?? c)].some(has));
    const n = (spec.nav ?? []).findIndex(has);
    lit = m >= 0 ? { kind: "menu", i: m } : r >= 0 ? { kind: "row", i: r } : n >= 0 ? { kind: "nav", i: n } : lit;
  }
  if (given(spec.lit) && lit.i < 0) missed(spec, warns, "on the screen");
  const open = menu && (menu.open || lit.kind === "menu");
  const menuRow = menu ? (menu.row ?? 1) - 1 : -1;
  const cols = spec.cols ?? [];
  const grid = `grid-template-columns: 2fr${" 1fr".repeat(Math.max(0, cols.length - 1))}${menu ? " 90px" : ""}`;
  const chip = (c) => (typeof c === "string" ? { text: c } : c);
  const menuHtml = open
    ? `<div class="cmenu">${menu.items.map((x, i) => (x.text === "-" ? "<hr>" : `<div class="${toneOf(x).trim()}${lit.kind === "menu" && lit.i === i ? " lit" : ""}">${prose(warns, "menu item", x.text)}</div>`)).join("")}</div>`
    : "";
  const body = rows.map((r, i) => {
    const cells = (r.cells ?? []).map((c, j) => (j === 0
      ? `<div class="cc0"><span class="cname">${prose(warns, "cell", c)}</span>${(r.chips ?? []).map(chip).map((x) => `<span class="cchip${toneOf(x)}">${prose(warns, "chip", x.text)}</span>`).join("")}${r.sub ? `<span class="csub">${prose(warns, "sub", r.sub)}</span>` : ""}</div>`
      : `<div>${prose(warns, "cell", c)}</div>`));
    const more = menu ? `<div class="cmore">&middot;&middot;&middot;${i === menuRow ? menuHtml : ""}</div>` : "";
    const on = (lit.kind === "row" && lit.i === i) || (lit.kind === "menu" && i === menuRow);
    const gone = spec.show !== undefined && i >= spec.show ? "; visibility:hidden" : "";
    return `<div class="crow${on ? " on keep" : ""}${lit.kind === "row" && lit.i === i ? " lit here" : ""}" style="${grid}${gone}">${cells.join("")}${more}</div>`;
  });
  const tab = typeof spec.tab === "number" ? spec.tab - 1 : spec.tab ? (spec.nav ?? []).findIndex((n) => String(n).includes(String(spec.tab))) : 0;
  const nav = (spec.nav ?? []).map((n, i) => `<span class="${i === tab ? "cur" : ""}${lit.kind === "nav" && lit.i === i ? " lit" : ""}">${prose(warns, "nav", n)}</span>`).join("");
  const [host, ...rest] = String(spec.url ?? "").replace(/^https?:\/\//, "").split("/");
  return `<div class="frame frame--inset"><div class="window">
<div class="browserbar">${lights}<div class="nav-buttons"><span>&lsaquo;</span><span>&rsaquo;</span><span>&circlearrowright;</span></div>
<div class="urlbar"><span><span class="host">${esc(host)}</span>${rest.length ? "/" + esc(rest.join("/")) : ""}</span></div></div>
<div class="console${lit.kind === "row" || lit.kind === "menu" ? " spotlight" : ""}">${nav ? `<nav class="cnav">${nav}</nav>` : ""}${spec.heading ? `<h1>${prose(warns, "heading", spec.heading)}</h1>` : ""}
${cols.length ? `<div class="chead" style="${grid}">${cols.map((c) => `<div>${prose(warns, "column", c)}</div>`).join("")}${menu ? "<div></div>" : ""}</div>` : ""}
<div class="cbody" data-fit="rows" data-trim="bottom">${body.join("")}</div></div></div></div>`;
};

// Who sends what to whom, in order. from/to are 1-based or an actor's name;
// "to" may be a list; "both": true draws a two-way arrow.
const sequence = (spec, warns) => {
  const actors = spec.actors ?? [];
  if (actors.length < 2) throw new Error(`a sequence frame needs two or more "actors"`);
  const msgs = spec.messages ?? [];
  const who = (x) => (typeof x === "number" ? x - 1 : actors.indexOf(x));
  const lit = pick(msgs, spec.lit, (m) => m.text ?? "");
  if (given(spec.lit) && !msgs[lit]) missed(spec, warns, "a message");
  const lane = Math.max(420, ...actors.map((a) => String(a).length * 21 + 120));
  const W = lane * actors.length;
  const X = (i) => lane * (i + 0.5);
  const top = 110;
  const step = 130;
  const H = top + 40 + msgs.length * step;
  const out = [];
  actors.forEach((a, i) => {
    const w = Math.min(lane - 40, String(a).length * 21 + 80);
    out.push(`<g class="sactor"><rect x="${X(i) - w / 2}" y="0" width="${w}" height="${top - 14}" rx="12"/><text x="${X(i)}" y="${(top - 14) / 2 + 12}">${prose(warns, "actor", a)}</text></g><line class="slife" x1="${X(i)}" y1="${top - 14}" x2="${X(i)}" y2="${H}"/>`);
  });
  msgs.forEach((m, k) => {
    const f = who(m.from);
    const tos = [m.to].flat().map(who);
    if (f < 0 || tos.some((t) => t < 0 || t === f)) throw new Error(`message ${k + 1}: "from" and "to" must name two different actors`);
    const y = top + 40 + k * step + 70;
    const lines = tos.map((t) => {
      const dir = Math.sign(X(t) - X(f));
      return `<line x1="${X(f) + dir * 10}" y1="${y}" x2="${X(t) - dir * 10}" y2="${y}"/>`;
    });
    const xs = [f, ...tos].map(X);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    out.push(`<g class="smsg${toneOf(m)}${m.both ? " both" : ""}${k === lit ? " lit" : ""}"${hidden(spec, k)}><text x="${mid}" y="${y - 22}">${prose(warns, "message", m.text ?? "")}</text>${lines.join("")}</g>`);
  });
  const marks = [["d", "#8b8b8b"], ["l", "var(--accent)"], ["ok", "var(--ok)"], ["bad", "var(--error)"], ["warn", "var(--warn)"]]
    .map(([id, c]) => `<marker id="se-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${c}"/></marker>`).join("");
  return centred(`${overline(spec, warns)}<svg class="gseq fitx${msgs[lit] ? " spotlight" : ""}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${marks}</defs>${out.join("")}</svg>`);
};

// The opening guess, as choices. Light the answer to reveal it: the rest are
// crossed out and every option's "why" shows.
const guess = (spec, warns) => {
  const opts = (spec.options ?? []).map((o) => (typeof o === "string" ? { text: o } : o));
  const lit = pick(opts, spec.lit, (o) => o.text ?? "");
  if (given(spec.lit) && !opts[lit]) missed(spec, warns, "an option");
  if (spec.answer !== undefined && !opts[spec.answer - 1]) warns.push(`answer ${spec.answer} is not an option`);
  const shown = spec.answer !== undefined && lit === spec.answer - 1;
  const html = opts.map((o, i) => {
    const cls = shown ? (i === lit ? " right lit" : " wrong") : i === lit ? " lit" : "";
    return `<div class="gopt${cls}"${hidden(spec, i)}><span class="gk">${String.fromCharCode(65 + i)}</span><span class="gt">${prose(warns, "option", o.text)}</span>${shown && o.why ? `<span class="gwhy">${prose(warns, "why", o.why)}</span>` : ""}</div>`;
  });
  return centred(`<div class="guess fitx${lit >= 0 && !shown ? " spotlight" : ""}">${spec.kicker ? `<div class="kicker">${esc(spec.kicker)}</div>` : ""}<h1 class="gq">${esc(spec.question ?? "")}</h1><div class="gopts">${html.join("")}</div></div>`);
};

// A Claude Code session: { you }, { say }, { tool, input }, { result }, { spin }.
const agent = (spec, warns) => {
  const lines = (spec.lines ?? []).map((l) => (typeof l === "string" ? { say: l } : l));
  const text = (l) => l.you ?? l.say ?? (l.tool ? `${l.tool}(${l.input ?? ""})` : l.result ?? l.spin ?? "");
  const lit = pick(lines, spec.lit, text);
  if (given(spec.lit) && !lines[lit]) missed(spec, warns, "a line of the session");
  const code = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
  const rows = lines.map((l, i) => {
    const here = i === lit ? " here" : "";
    const h = hidden(spec, i);
    if (l.you !== undefined) return `<span class="you${here}"${h}>${code(l.you)}</span>`;
    if (l.tool !== undefined) return `<span class="tool${here}"${h}><b>${esc(l.tool)}</b>(${esc(l.input ?? "")})</span>`;
    if (l.result !== undefined) return `<span class="result${here}"${h}>${esc(l.result)}</span>`;
    if (l.spin !== undefined) return `<span class="spin${here}"${h}>✻ ${esc(l.spin)}</span>`;
    return `<span class="say${here}"${h}>${code(l.say ?? "")}</span>`;
  });
  return `<div class="frame frame--inset"><div class="window">
<div class="titlebar">${lights}<span class="title">${esc(spec.title ?? "Claude Code")}</span></div>
<div class="terminal cc gen${lit >= 0 ? " spotlight" : ""}" data-fit="rows" data-trim="top">${rows.join("")}</div></div></div>`;
};

// A hierarchy. Items in reading order with a depth (0 is the root), or
// strings indented two spaces a level. The branches are drawn.
const tree = (spec, warns) => {
  const items = (spec.items ?? []).map((it) => {
    if (typeof it !== "string") return { depth: 0, ...it };
    const pad = it.match(/^ */)[0].length;
    return { text: it.trim(), depth: Math.floor(pad / 2) };
  });
  const last = (i) => {
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].depth < items[i].depth) return true;
      if (items[j].depth === items[i].depth) return false;
    }
    return true;
  };
  const prefix = (i) => {
    const d = items[i].depth;
    if (!d) return "";
    let s = "";
    for (let k = 1; k < d; k++) {
      let a = i;
      while (a >= 0 && items[a].depth !== k) a--;
      s += a >= 0 && !last(a) ? "│  " : "   ";
    }
    return s + (last(i) ? "└─ " : "├─ ");
  };
  const lit = pick(items, spec.lit, (it) => it.text ?? "");
  if (given(spec.lit) && !items[lit]) missed(spec, warns, "an item");
  const html = items.map((it, i) => `<div class="trow${toneOf(it)}${i === lit ? " lit" : ""}"${hidden(spec, i)}><span class="tbr">${prefix(i)}</span><span class="ttx">${prose(warns, "item", it.text)}</span>${it.sub ? `<span class="tsb">${prose(warns, "item sub", it.sub)}</span>` : ""}</div>`);
  return centred(`${overline(spec, warns)}<div class="gtree fitx${items[lit] ? " spotlight" : ""}">${html.join("")}</div>`);
};

// Layers inside layers, innermost first. "show" counts from the inside out.
const stack = (spec, warns) => {
  const layers = spec.layers ?? [];
  const lit = pick(layers, spec.lit, (l) => `${l.name ?? ""} ${l.sub ?? ""}`);
  if (given(spec.lit) && !layers[lit]) missed(spec, warns, "a layer");
  let html = "";
  layers.forEach((l, i) => {
    const vis = spec.show !== undefined && i >= spec.show ? "hidden" : "visible";
    html = `<div class="layer${i === 0 ? " core" : ""}${toneOf(l)}${i === lit ? " lit" : ""}" style="visibility:${vis}"><div class="lhead"><b>${prose(warns, "layer", l.name ?? "")}</b>${l.sub ? `<span>${prose(warns, "layer sub", l.sub)}</span>` : ""}</div>${html}</div>`;
  });
  return centred(`${overline(spec, warns)}<div class="gstack fitx${layers[lit] ? " spotlight" : ""}">${html}</div>`);
};

const MORE = { table, anatomy, timeline, console: consoleFrame, sequence, guess, agent, tree, stack };


// spec -> { html, warns }. css is house.css, inlined so a page needs no file.
export const frameHtml = async (spec, { dir, home, css }) => {
  const warns = [];
  if (!TYPES.includes(spec.type)) throw new Error(`frame type "${spec.type}" is not one of ${TYPES.join(", ")}`);
  if (spec.show === 0 && spec.type !== "anatomy") warns.push(`"show": 0 leaves the frame empty; show the first item`);
  const body =
    spec.type === "code" ? await code(spec, dir, home, warns)
    : spec.type === "terminal" ? terminal(spec, warns)
    : spec.type === "title" ? title(spec, warns)
    : spec.type === "diagram" ? diagram(spec, warns)
    : spec.type === "list" ? list(spec, warns)
    : spec.type === "page" ? page(spec, warns)
    : spec.type === "split" ? await split(spec, dir, home, warns)
    : MORE[spec.type](spec, warns);
  return { html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`, warns };
};

// Runs in the page before capture. Rows that do not fit are folded away,
// farthest from the lit row first (a terminal drops its oldest lines), and a
// centred block that does not fit shrinks, never below the 28px floor.
export const fitInPage = () => {
  const fixes = [];
  const over = (el) => el.scrollHeight > el.clientHeight + 2;
  for (const box of document.querySelectorAll('[data-fit="rows"]')) {
    const trim = box.dataset.trim;
    let dropped = 0;
    for (let guard = 0; over(box) && guard < 2000; guard++) {
      const all = [...box.children];
      const lit = box.querySelector(".here");
      const li = lit ? all.indexOf(lit) : -1;
      const can = all.filter((r) => !r.classList.contains("fold") && !r.classList.contains("keep") && r !== lit);
      if (!can.length) break;
      let victim;
      if (trim === "top") victim = can[0];
      else if (trim === "bottom" || li < 0) victim = can[can.length - 1];
      else victim = can.reduce((a, b) => (Math.abs(all.indexOf(b) - li) > Math.abs(all.indexOf(a) - li) ? b : a));
      const near = [victim.previousElementSibling, victim.nextElementSibling].some((s) => s && s.classList.contains("fold"));
      if (near || trim === "bottom") victim.remove();
      else {
        const fold = document.createElement("span");
        fold.className = box.classList.contains("code") ? "l fold" : "fold";
        fold.dataset.n = "";
        fold.textContent = " ";
        victim.replaceWith(fold);
      }
      dropped++;
    }
    if (dropped) fixes.push(`folded ${dropped} line${dropped > 1 ? "s" : ""} to fit`);
  }
  const frame = document.querySelector(".frame");
  const warns = [];
  // A centred block is sized to its box: grown until it fills the frame, or
  // shrunk (never below the 28px floor) until it fits.
  for (const box of document.querySelectorAll('[data-fit="scale"]')) {
    let smallest = Infinity;
    for (const el of box.querySelectorAll("*")) if ([...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
    const floor = Math.min(1, 28 / smallest);
    const tooBig = () => frame.scrollHeight > frame.clientHeight + 2 || [...box.querySelectorAll(".diagram, .biglist, .fitx")].some((el) => el.scrollWidth > el.clientWidth + 2);
    // The content's own extent, whatever its wrappers' widths.
    const extent = () => {
      const rs = [...box.querySelectorAll(".card, .node, .arrow, li, .overline, .annotation, .fitx")].map((el) => el.getBoundingClientRect()).filter((r) => r.width);
      const l = Math.min(...rs.map((r) => r.left)), r = Math.max(...rs.map((r) => r.right));
      const t = Math.min(...rs.map((r) => r.top)), b = Math.max(...rs.map((r) => r.bottom));
      return { w: r - l, h: b - t };
    };
    const W = frame.clientWidth - 192;
    const H = frame.clientHeight - 192;
    // First tighten the boxes (no text shrinks), then shrink to the floor,
    // and only then wrap a diagram onto a second row.
    if (tooBig()) {
      box.classList.add("tight");
      fixes.push("tightened to fit");
    }
    const { w, h } = extent();
    let z = Math.min(2.2, (W * 0.9) / w, (H * 0.85) / h);
    z = Math.max(floor, Math.floor(z * 20) / 20);
    box.style.zoom = String(z);
    while (tooBig() && z - 0.05 >= floor - 1e-9) {
      z -= 0.05;
      box.style.zoom = String(z);
    }
    if (z > 1) fixes.push(`grown to ${Math.round(z * 100)}% to fill the frame`);
    if (z < 1) fixes.push(`shrunk to ${Math.round(z * 100)}% to fit`);
    if (tooBig()) {
      box.classList.add("wrap");
      fixes.push("wrapped onto two rows to fit");
    }
    const span = extent().w;
    if (span < frame.clientWidth / 2) warns.push(`content spans ${Math.round((span / frame.clientWidth) * 100)}% of the width; a frame is at least half filled`);
  }
  return { fixes, warns };
};
