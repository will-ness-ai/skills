// One interface over pluggable backends:
//   classify({ window, state, event }) => { actions: [{ type, target, reason, confidence }], meta }
// Every action in actions.mjs is its own yes/no question with its own threshold.
// Fails open: an error or timeout gives actions: [].
import { ACTIONS } from "./actions.mjs";
import * as haiku from "./backends/haiku.mjs";
import * as jev from "./backends/jev.mjs";

const BACKENDS = { haiku, jev };

export async function classify(input, opts = {}) {
  const backend = opts.backend || process.env.BWM_BACKEND || "haiku";
  const o = {
    prompt: process.env.BWM_PROMPT || "v3",
    model: process.env.BWM_MODEL || "claude-haiku-5-5",
    timeoutMs: Number(opts.timeoutMs || process.env.BWM_TIMEOUT_MS || 12000),
    effort: process.env.BWM_EFFORT || "low",
  };
  let res;
  try { res = await (BACKENDS[backend] ?? haiku).run(input, o); }
  catch (e) { res = { scores: {}, meta: { backend, error: "throw: " + e.message } }; }
  const actions = ACTIONS.map((a) => ({ a, s: res.scores[a.type] })).filter(({ a, s }) => s && s.p >= a.threshold)
    .map(({ a, s }) => ({ type: a.type, target: s.target, reason: s.reason, confidence: s.p }));
  return { actions, meta: res.meta };
}
