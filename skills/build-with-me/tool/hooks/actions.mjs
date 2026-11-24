// The action taxonomy. Each action is an independent yes/no question, so any
// backend (a text LLM like Haiku, or a probability classifier like Jev) can
// answer it and we can threshold each one separately. `command` is what a live-mode hook message
// asks the agent to run (bwm stands for the tool's full path).
export const ACTIONS = [
  {
    type: 'board.add_card',
    command: "bwm card add --phase <phase> --title \"<title>\" --status <status>",
    threshold: 0.6,
    question: 'Did a new unit of work, risk or blocker just appear that the page board does not already show?',
    description: 'New task, subtask, risk or blocker that will take real work. Not for one-off commands or things already on the board.',
  },
  {
    type: 'board.move_card',
    command: "bwm card set <id> --status <status> --note \"<short note>\"",
    threshold: 0.6,
    question: 'Did a card already on the board just change status (for example to working, failed, done, waiting) or phase?',
    description: 'Status/phase change on an existing card: work started, failed, finished, or is now blocked on someone.',
  },
  {
    type: 'design.update',
    command: "bwm goal --ask \"<\u2026>\"  or  bwm decision add --topic \"<\u2026>\" --text \"<one plain sentence>\"",
    threshold: 0.6,
    question: 'Was a design decision just settled or reversed, a new open design question raised, or the goal or done-when list changed?',
    description: 'Changes to the design band: goal, why, done-when, the ask, today vs after, decisions settled/open/next.',
  },
  {
    type: 'proof.build',
    command: "bwm proof add --kind golden|edge|error|hardening --title \"<the claim>\", then capture the run",
    threshold: 0.6,
    question: 'Was something just built or fixed that now needs captured evidence (a real run, edge/error case, screenshot or video) that does not exist yet?',
    description: 'Evidence to capture next. Fires when the agent claims something works without a captured run.',
  },
  {
    type: 'proof.attach',
    command: "bwm proof step <id> --did \"<\u2026>\" --expected \"<\u2026>\" --got \"<\u2026>\" --evidence <file>",
    threshold: 0.6,
    question: 'Did the agent just produce evidence (a captured run log, test output, screenshot, video) that should be attached to a card as proof?',
    description: 'Evidence already exists in the window; attach it. Distinct from proof.build, which asks for evidence to be made.',
  },
  {
    type: 'ask.queue',
    command: "bwm ask --topic \"<\u2026>\" --title \"<question>\" --option \"<label>|<what happens>\" --rec 1",
    threshold: 0.6,
    question: 'Does the agent need a decision, check or input from the human that should be queued on the page (not just answered in chat)?',
    description: 'Human-turn items: an answer or a check the agent cannot do itself. Not for rhetorical or chat-only questions.',
  },
];

export const TYPES = ACTIONS.map(a => a.type);
export const byType = Object.fromEntries(ACTIONS.map(a => [a.type, a]));
