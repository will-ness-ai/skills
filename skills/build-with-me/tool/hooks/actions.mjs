// The action taxonomy. Each action is an independent yes/no question, so any
// backend (a text LLM like Haiku, or a probability classifier like Jev) can
// answer it and we can threshold each one separately.
export const ACTIONS = [
  {
    type: 'board.add_card',
    threshold: 0.6,
    question: 'Did a new unit of work, risk or blocker just appear that the page board does not already show?',
    description: 'New task, subtask, risk or blocker that will take real work. Not for one-off commands or things already on the board.',
  },
  {
    type: 'board.move_card',
    threshold: 0.6,
    question: 'Did a card already on the board just change status (for example to working, failed, done, waiting) or phase?',
    description: 'Status/phase change on an existing card: work started, failed, finished, or is now blocked on someone.',
  },
  {
    type: 'design.update',
    threshold: 0.6,
    question: 'Was a design decision just settled or reversed, a new open design question raised, or the goal or done-when list changed?',
    description: 'Changes to the design band: goal, why, done-when, the ask, today vs after, decisions settled/open/next.',
  },
  {
    type: 'proof.build',
    threshold: 0.6,
    question: 'Was something just built or fixed that now needs captured evidence (a real run, edge/error case, screenshot or video) that does not exist yet?',
    description: 'Evidence to capture next. Fires when the agent claims something works without a captured run.',
  },
  {
    type: 'proof.attach',
    threshold: 0.6,
    question: 'Did the agent just produce evidence (a captured run log, test output, screenshot, video) that should be attached to a card as proof?',
    description: 'Evidence already exists in the window; attach it. Distinct from proof.build, which asks for evidence to be made.',
  },
  {
    type: 'ask.queue',
    threshold: 0.6,
    question: 'Does the agent need a decision, check or input from the human that should be queued on the page (not just answered in chat)?',
    description: 'Human-turn items: an answer or a check the agent cannot do itself. Not for rhetorical or chat-only questions.',
  },
];

export const TYPES = ACTIONS.map(a => a.type);
export const byType = Object.fromEntries(ACTIONS.map(a => [a.type, a]));
