// Read the tail of a Claude Code transcript (JSONL) and turn it into the
// compact "window" the classifier reads. Zero deps.
import fs from 'node:fs';

// Tool names that are the page tools themselves. Calls to these are never
// shown to the classifier as "work", and their presence is used for debounce.
export const PAGE_TOOL_RE = /(^|__)(page_|board_|bwm_)|build-with-me|bwm\.mjs|(^|[\s;&|])bwm\s/i;

const clip = (s, n) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n) + '…' : s;
};

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}

function resultText(block) {
  const c = block.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(x => (x.type === 'text' ? x.text : `[${x.type}]`)).join(' ');
  return '';
}

function isPageCall(name, input) {
  if (PAGE_TOOL_RE.test(name)) return true;
  if (name === 'Bash' && input && PAGE_TOOL_RE.test(String(input.command || ''))) return true;
  return false;
}

// Reads only the last `maxBytes` of the file so cost stays flat on long sessions.
export function readTail(path, maxBytes = 200_000) {
  let buf;
  try {
    const fd = fs.openSync(path, 'r');
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
  } catch { return []; }
  const lines = buf.toString('utf8').split('\n');
  if (lines.length && buf.length >= maxBytes) lines.shift(); // partial first line
  const out = [];
  for (const l of lines) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch {} }
  return out;
}

// Build the window: last human message, last assistant text, last N tool calls
// (excluding page-tool calls), and how many tool calls ago the page was touched.
export function buildWindow(entries, { maxTools = 6, extra = {} } = {}) {
  const msgs = entries.filter(e => (e.type === 'user' || e.type === 'assistant') && e.message && !e.isSidechain);
  const results = new Map();
  for (const m of msgs) {
    if (m.type !== 'user' || !Array.isArray(m.message.content)) continue;
    for (const b of m.message.content) if (b.type === 'tool_result') results.set(b.tool_use_id, { text: resultText(b), err: !!b.is_error });
  }
  let user = '', assistant = '';
  const tools = [];
  let sinceLastPageCall = null, toolCount = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const c = m.message.content;
    if (m.type === 'user') {
      const t = textOf(c);
      // skip tool_result-only user entries and harness meta messages
      if (!user && t && !m.isMeta && !/^<(local-command|command-|system-reminder)/.test(t.trim())) user = t;
    } else {
      if (!assistant) { const t = textOf(c); if (t.trim()) assistant = t; }
      if (Array.isArray(c)) for (const b of [...c].reverse()) {
        if (b.type !== 'tool_use') continue;
        toolCount++;
        if (isPageCall(b.name, b.input)) { if (sinceLastPageCall === null) sinceLastPageCall = toolCount - 1; continue; }
        if (tools.length < maxTools) {
          const r = results.get(b.id) || {};
          tools.unshift({ name: b.name, input: clip(JSON.stringify(b.input), 160), result: clip(r.text, 200), error: r.err || undefined });
        }
      }
    }
    if (user && assistant && tools.length >= maxTools) break;
  }
  return { user: clip(user, 1200), assistant: clip(assistant, 1200), tools, sinceLastPageCall, ...extra };
}
