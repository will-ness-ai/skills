// Haiku backend: one `claude -p` call that answers every action question at
// once and returns a self-reported confidence per action. Not calibrated
// probabilities; treat as scores.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES } from '../actions.mjs';

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { type: { type: 'string', enum: TYPES }, target: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'number' } },
        required: ['type', 'target', 'reason', 'confidence'],
      },
    },
  },
  required: ['actions'],
};

export function loadPrompt(name) {
  return fs.readFileSync(path.join(HERE, 'prompts', `${name}.txt`), 'utf8');
}

// v1 render: everything shown flat. v2+ render: marks which part is NEW at this
// event, so the classifier stops re-acting on a human message it already saw.
export function renderInput({ window: w, state, event }, style = 'v2') {
  const tools = (w.tools || []).map(t => `- ${t.name} ${t.input}${t.error ? ' [nonzero exit/error]' : ''}\n  -> ${t.result || '(no output)'}`).join('\n') || '(none)';
  const touched = `PAGE LAST TOUCHED: ${w.sinceLastPageCall == null ? 'not in recent window' : `${w.sinceLastPageCall} tool calls ago`}`;
  const st = `PAGE STATE:\n${typeof state === 'string' ? state : JSON.stringify(state)}`;
  if (style === 'v1') return [
    `EVENT: ${event || 'unknown'}`, st, touched,
    `LAST HUMAN MESSAGE:\n${w.user || '(none)'}`,
    `RECENT TOOL CALLS (oldest first):\n${tools}`,
    `LAST AGENT MESSAGE:\n${w.assistant || '(none)'}`,
  ].join('\n\n');
  const human = `HUMAN MESSAGE:\n${w.user || '(none)'}`, agent = `AGENT MESSAGE:\n${w.assistant || '(none)'}`, tc = `TOOL CALLS (oldest first):\n${tools}`;
  let ctx, fresh;
  if (event === 'UserPromptSubmit') { ctx = [agent]; fresh = [human]; }
  else if (event === 'Stop') { ctx = [human, tc]; fresh = [agent]; } // tools were judged at PostToolBatch
  else { ctx = [human]; fresh = [tc]; } // PostToolBatch / PostToolUse
  return [`EVENT: ${event || 'unknown'}`, st, touched,
    `=== CONTEXT (already handled; do not act on it again) ===\n${ctx.join('\n\n')}`,
    `=== NEW AT THIS EVENT (judge only this) ===\n${fresh.join('\n\n')}`].join('\n\n');
}

function extractJson(s) {
  if (!s) return null;
  s = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

export async function run(input, opts = {}) {
  const { prompt = 'v3', model = 'claude-haiku-5-5', timeoutMs = 15000, schema = false, effort = 'low' } = opts;
  const args = [
    '-p', '--model', model, '--output-format', 'json',
    '--system-prompt', loadPrompt(prompt),
    '--tools', '',              // no tools: one model turn, no agent loop
    '--strict-mcp-config',      // no MCP servers
    '--setting-sources', '',    // no user/project settings => our hooks never load in the child
    '--disable-slash-commands',
    '--no-session-persistence',
  ];
  if (effort) args.push('--effort', effort);
  if (schema) args.push('--json-schema', JSON.stringify(SCHEMA));
  const meta = { backend: 'haiku', prompt, model, schema, ms: 0, cost_usd: 0, error: null, raw: null };
  const t0 = Date.now();
  const out = await new Promise(resolve => {
    let stdout = '', stderr = '', done = false;
    const child = spawn('claude', args, { env: { ...process.env, BWM_CLASSIFIER_CHILD: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { if (!done) { done = true; meta.error = 'timeout'; child.kill('SIGKILL'); resolve(null); } }, timeoutMs);
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('error', e => { if (!done) { done = true; clearTimeout(timer); meta.error = 'spawn: ' + e.message; resolve(null); } });
    child.on('close', code => {
      if (done) return;
      done = true; clearTimeout(timer);
      if (code !== 0 && !stdout) { meta.error = `exit ${code}: ${stderr.slice(0, 200)}`; return resolve(null); }
      resolve(stdout);
    });
    child.stdin.end(renderInput(input, prompt === 'v1' ? 'v1' : 'v2')); // via stdin: no argv length limits
  });
  meta.ms = Date.now() - t0;
  if (!out) return { scores: {}, meta };
  let env;
  try { env = JSON.parse(out.slice(0, out.lastIndexOf('}') + 1)); } catch { meta.error = 'bad cli json'; return { scores: {}, meta }; }
  meta.cost_usd = env.total_cost_usd || 0;
  meta.api_ms = env.duration_api_ms;
  meta.out_tokens = env.usage?.output_tokens;
  meta.in_tokens = (env.usage?.input_tokens || 0) + (env.usage?.cache_read_input_tokens || 0) + (env.usage?.cache_creation_input_tokens || 0);
  meta.turns = env.num_turns;
  if (env.is_error) { meta.error = 'cli: ' + String(env.result).slice(0, 200); return { scores: {}, meta }; }
  const obj = env.structured_output || extractJson(env.result);
  meta.raw = env.structured_output ? JSON.stringify(obj) : env.result;
  if (!obj || !Array.isArray(obj.actions)) { meta.error = 'unparseable'; return { scores: {}, meta }; }
  const scores = {};
  for (const a of obj.actions) {
    if (!a || !TYPES.includes(a.type)) continue; // 'none' and unknown types are dropped
    const p = Math.max(0, Math.min(1, Number(a.confidence ?? 0.5)));
    if (!scores[a.type] || p > scores[a.type].p) scores[a.type] = { p, target: String(a.target ?? ''), reason: String(a.reason ?? '') };
  }
  return { scores, meta };
}
