// map.js: the course's shared map. One picture of the learner's world that every
// lesson reuses and adds to. It draws into <body> from a state object:
//
//   window.MAP = { title, grid, nodes, zones, edges, show, lit }   (a frame stub sets this)
//   map.html?s=<url-encoded JSON of the same object>               (to look at one by hand)
//
// tools/lesson.mjs writes the stubs: it merges course.json's "map", the lesson's
// "scene" and each moment's change into this state. The shapes:
//
//   nodes [{ id, col, row, title, sub, state }]     x, y in px place a node off the grid
//   zones [{ id, label, from: [col,row], to: [col,row], align: "left"|"right", x1: px }]
//   edges [{ id, from, to, style: "solid"|"dashed", arrows: "both"|"end"|"none", label,
//            group, state, labelAt: 0..1, labelSide: 1|-1, shift: px }]
//   show  ids that are visible. Everything else is drawn hidden, so it keeps its place.
//   lit   one id, or one edge group name: the one thing this frame lights. null = overview.
//   state node: "off" (dashed, dim). edge: "blocked" (red, crossed) | "ok" (green).
//   grid  { cols: [px...], rows: [px...] }, default 5 x 3.
//
// Keep everything above y = 930: burned-in captions own the band below it.
(() => {
  const q = new URLSearchParams(location.search).get("s");
  const S = window.MAP ?? (q ? JSON.parse(q) : {});
  const nodes = S.nodes ?? [], zones = S.zones ?? [], edges = S.edges ?? [];
  const shown = new Set(S.show ?? [...nodes, ...zones, ...edges].map((x) => x.id));
  const COLS = S.grid?.cols ?? [230, 595, 960, 1325, 1690];
  const ROWS = S.grid?.rows ?? [200, 500, 800];
  const MID = (COLS[0] + COLS[COLS.length - 1]) / 2;
  const lit = S.lit ?? null;
  const isLit = (x) => lit !== null && (x.id === lit || x.group === lit);
  const litEdges = edges.filter(isLit);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const frame = document.createElement("div");
  frame.className = "frame map";
  let html = S.title ? `<div class="overline">${esc(S.title)}</div>` : "";
  for (const z of zones) {
    const x0 = COLS[z.from[0]] - 200, x1 = z.x1 ?? COLS[z.to[0]] + 200, y0 = ROWS[z.from[1]] - 128, y1 = ROWS[z.to[1]] + 92;
    html += `<div class="zone${shown.has(z.id) ? "" : " hidden"}${lit !== null ? " muted" : ""}${(z.align ?? (COLS[z.from[0]] > MID ? "right" : "left")) === "right" ? " right" : ""}" style="left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px"><span>${esc(z.label)}</span></div>`;
  }
  for (const n of nodes) {
    // A lit edge keeps its two ends at full strength; everything else steps back.
    const near = litEdges.some((e) => e.from === n.id || e.to === n.id);
    const cls = ["node", shown.has(n.id) ? "" : "hidden", isLit(n) ? "lit" : lit !== null && !near ? "muted" : "", n.state === "off" ? "off" : ""].filter(Boolean).join(" ");
    html += `<div class="${cls}" data-id="${n.id}" style="left:${n.x ?? COLS[n.col]}px;top:${n.y ?? ROWS[n.row]}px"><div class="node-title">${esc(n.title)}</div>${n.sub ? `<div class="node-sub">${esc(n.sub)}</div>` : ""}</div>`;
  }
  frame.innerHTML = html + `<svg viewBox="0 0 1920 1080"></svg>`;
  document.body.appendChild(frame);

  // Edges run from box edge to box edge, measured after layout, so an arrow
  // always meets its node whatever the label inside it says.
  const box = (id) => {
    const el = frame.querySelector(`.node[data-id="${id}"]`);
    return { cx: el.offsetLeft, cy: el.offsetTop, w: el.offsetWidth / 2, h: el.offsetHeight / 2 };
  };
  // Where the line p + t*d is inside box b (grown by gap): [tEnter, tLeave].
  const span = (b, px, py, dx, dy, gap) => {
    let t0 = -Infinity, t1 = Infinity;
    for (const [p, d, c, r] of [[px, dx, b.cx, b.w + gap], [py, dy, b.cy, b.h + gap]]) {
      if (Math.abs(d) < 1e-9) continue;
      const u = (c - r - p) / d, v = (c + r - p) / d;
      t0 = Math.max(t0, Math.min(u, v));
      t1 = Math.min(t1, Math.max(u, v));
    }
    return [t0, t1];
  };
  const head = (x, y, ux, uy) => {
    const L = 26, W = 12;
    return `<polygon points="${x},${y} ${x - ux * L - uy * W},${y - uy * L + ux * W} ${x - ux * L + uy * W},${y - uy * L - ux * W}"/>`;
  };
  let svg = "";
  for (const e of edges) {
    const a = box(e.from), b = box(e.to);
    const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    const arrows = e.arrows ?? "end";
    // shift moves the line sideways (positive = down, or right for a vertical
    // line) before it is cut at the two boxes, so two edges between one pair
    // run in parallel and each still starts and ends on a box edge.
    let mxn = -uy, myn = ux;
    if (myn < 0 || (myn === 0 && mxn < 0)) { mxn = -mxn; myn = -myn; }
    const ox = mxn * (e.shift ?? 0), oy = myn * (e.shift ?? 0);
    const px = a.cx + ox, py = a.cy + oy;
    // An arrowhead stops 14px short of its box; a plain tail runs up to 6px from it.
    const ta = span(a, px, py, ux, uy, arrows === "both" ? 14 : 6)[1], tb = span(b, px, py, ux, uy, arrows === "none" ? 6 : 14)[0];
    const x1 = px + ux * ta, y1 = py + uy * ta, x2 = px + ux * tb, y2 = py + uy * tb;
    const cls = ["edge", shown.has(e.id) ? "" : "hidden", e.style === "dashed" ? "dashed" : "", e.state ?? "", isLit(e) ? "lit" : lit !== null ? "muted" : ""].filter(Boolean).join(" ");
    let g = "";
    if (arrows === "end" || arrows === "both") g += head(x2, y2, ux, uy);
    if (arrows === "both") g += head(x1, y1, -ux, -uy);
    // The line stops at the base of each arrowhead.
    const lx2 = arrows === "none" ? x2 : x2 - ux * 22, ly2 = arrows === "none" ? y2 : y2 - uy * 22;
    const lx1 = arrows === "both" ? x1 + ux * 22 : x1, ly1 = arrows === "both" ? y1 + uy * 22 : y1;
    g = `<line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}"/>` + g;
    const t = e.labelAt ?? 0.5, mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
    if (e.state === "blocked") g += `<line class="cross" x1="${mx - 20}" y1="${my - 20}" x2="${mx + 20}" y2="${my + 20}"/><line class="cross" x1="${mx + 20}" y1="${my - 20}" x2="${mx - 20}" y2="${my + 20}"/>`;
    if (e.label) {
      // The label sits beside the line: above it (labelSide 1, the default) or
      // below it (-1). Beside a sloping line it starts or ends at the line and
      // runs away from it, so it never lies across it.
      const side = e.labelSide ?? 1, sx = -mxn * side, sy = -myn * side;
      const flat = Math.abs(uy) < 0.03, clear = e.state === "blocked" ? 30 : 0;
      const anchor = flat ? "middle" : sx > 0 ? "start" : "end";
      const lx = flat ? mx : mx + sx * 26 + (sx > 0 ? 8 : -8);
      const ly = Math.abs(sy) < 0.03 ? my + 10 : sy < 0 ? my + sy * (26 + clear) - 6 : my + sy * (26 + clear) + 20;
      g += `<text style="text-anchor:${anchor}" x="${lx}" y="${ly}">${esc(e.label)}</text>`;
    }
    svg += `<g class="${cls}" data-id="${e.id}">${g}</g>`;
  }
  frame.querySelector("svg").innerHTML = svg;
})();
