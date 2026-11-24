// Jev ("System One", TypeSafe) backend — STUB. No key, no network calls.
//
// Jev returns probabilities, ~300 ms/call, and answers yes/no ("noul") or
// single-choice questions. It has no multi-label mode, so we ask one noul per
// action and threshold each P(yes) independently.
//
// Gated on TYPESAFE_API_KEY. Without it, run() returns no scores (fail open).
// The request shape below is our guess at the contract and must be checked
// against TypeSafe's real API before use.
import { ACTIONS } from '../actions.mjs';
import { renderInput } from './haiku.mjs';

export function buildRequests(input) {
  // `state` = the transcript window (what happened); the board summary rides
  // along inside each question so every noul is self-contained.
  const state = renderInput({ ...input, state: '(see question)' });
  const board = typeof input.state === 'string' ? input.state : JSON.stringify(input.state);
  return ACTIONS.map(a => ({
    type: a.type,
    body: {
      state,
      questions: [{ kind: 'noul', text: `${a.question}\nDefinition: ${a.description}\nCurrent page:\n${board}` }],
    },
  }));
}

export async function run(input, opts = {}) {
  const meta = { backend: 'jev', ms: 0, cost_usd: 0, error: null };
  if (!process.env.TYPESAFE_API_KEY) { meta.error = 'TYPESAFE_API_KEY not set (stub)'; return { scores: {}, meta }; }
  const reqs = buildRequests(input);
  // TODO: POST each req.body in parallel (one noul per action, ~300 ms each),
  // read P(yes), and map to scores[req.type] = { p, target: '', reason: '' }.
  // Jev gives no rationale and no target, so the hook message has to say
  // "a board move may be due" and leave the target to the main agent.
  meta.error = 'jev backend not implemented (stub)';
  meta.requests = reqs.length;
  return { scores: {}, meta };
}
