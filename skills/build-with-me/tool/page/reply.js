// The reply format the human pastes from a rendered page, and TOON cell quoting. One owner for both
// sides: the page loads this file as a script, and bwm imports it (it sets globalThis.BWMReply).
//
//   My build-with-me answers (Claude: save this to a file and run bwm import --reply-file <path>):
//   answers[2]{card,question,pick,flags,verdict,note}:
//     4,Ship it?,1,,,
//     9,Looks right on your phone?,,,off,"The header wraps\n- on the home page"
//   seen: 3 5
(function () {
  const FIELDS = ["card", "question", "pick", "flags", "verdict", "note"];
  const FLAGS = ["unsure", "prototype", "bakeoff"];
  const LEAD = "My build-with-me answers (Claude: save this to a file and run bwm import --reply-file <path>):";

  // A value holding a comma, colon, quote, backslash or line break is quoted, with \" \\ and \n.
  const cell = (v) => {
    v = v === null || v === undefined ? "" : String(v).replace(/\r\n?/g, "\n");
    return /[,:"\\\n]/.test(v) ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"` : v;
  };

  // answers: { [cardId]: { pick, unsure, prototype, bakeoff, take, verdict, comment } }; titles: id -> title
  function encode(answers, titles = {}, seen = []) {
    const rows = Object.entries(answers).map(([id, a]) =>
      [id, titles[id], a.pick, FLAGS.filter((f) => a[f]).join(" "), a.verdict, a.take ?? a.comment].map(cell).join(","));
    return [LEAD, `answers[${rows.length}]{${FIELDS.join(",")}}:`, ...rows.map((r) => `  ${r}`), ...(seen.length ? [`seen: ${seen.join(" ")}`] : [])].join("\n");
  }

  // Splits rows into cells, character by character: a line break inside a quoted value (a shell or a
  // chat that turned \n into a real newline) stays in the value. Rows end at a line break outside
  // quotes; the block ends at "seen:", a blank line, or the end of the text.
  function rowsOf(body) {
    const rows = []; let cells = [], cur = "", q = false, started = false;
    const end = () => { if (started) { cells.push(cur); rows.push(cells); } cells = []; cur = ""; started = false; };
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (q) { if (ch === "\\" && i + 1 < body.length) { const n = body[++i]; cur += n === "n" ? "\n" : n; } else if (ch === '"') q = false; else cur += ch; continue; }
      if (ch === "\r") continue;
      if (ch === "\n") { end(); const rest = body.slice(i + 1); if (/^\s*(seen:|$)/.test(rest.split("\n")[0])) break; continue; }
      if (!started) { if (ch === " " || ch === "\t") continue; started = true; }
      if (ch === '"') q = true; else if (ch === ",") { cells.push(cur); cur = ""; } else cur += ch;
    }
    end();
    return rows;
  }

  // Returns { answers, seen, expected, read } or null when there is no answers block. The older
  // one-line JSON form (bwm-answers {...}) still reads.
  function parse(text) {
    text = String(text ?? "");
    const j = text.match(/bwm-answers\s+(\{[\s\S]*\})/);
    if (j) { try { const p = JSON.parse(j[1]); const n = Object.keys(p.answers ?? {}).length; return { answers: p.answers ?? {}, seen: p.seen ?? [], expected: n, read: n }; } catch { return null; } }
    const m = text.match(/^[ \t]*answers\[(\d+)\]\{([^}]*)\}:[ \t]*$/m);
    if (!m) return null;
    const fields = m[2].split(","), answers = {};
    const rows = rowsOf(text.slice(m.index + m[0].length).replace(/^\r?\n/, ""));
    for (const c of rows) {
      const r = Object.fromEntries(fields.map((k, n) => [k, c[n] ?? ""])), a = {};
      if (!r.card) continue;
      if (r.pick) a.pick = r.pick;
      for (const f of (r.flags || "").split(/\s+/).filter(Boolean)) a[f] = true;
      if (r.verdict) { a.verdict = r.verdict; if (r.note) a.comment = r.note; } else if (r.note) a.take = r.note;
      answers[r.card] = a;
    }
    const seen = (text.match(/^[ \t]*seen:[ \t]*(.*)$/m)?.[1] ?? "").split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isInteger);
    return { answers, seen, expected: Number(m[1]), read: Object.keys(answers).length };
  }

  globalThis.BWMReply = { FIELDS, FLAGS, cell, encode, parse };
})();
