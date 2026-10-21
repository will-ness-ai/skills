import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'workflow-status',
  component: 'Pane',
  requestId: 'workflow-status',
  props: {
    title: 'Workflow',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// A repo with AGENTS.md linked as CLAUDE.md, the workflow doc and CI, and
// nothing else. Nothing sits beneath the plugin: these hooks stand for the
// engine's file system.
const FILES: Record<string, string> = {
  'AGENTS.md': '# Agents\n\nSee docs/agents/DEVELOPMENT_WORKFLOW.md.\n',
  'CLAUDE.md': '# Agents\n',
  'docs/agents/DEVELOPMENT_WORKFLOW.md': '# Development workflow\n',
  '.claude/skills/tdd/SKILL.md': '---\nname: tdd\n---\n',
}

// The engine hands file hooks the path resolved against the working
// directory, which under test is the plugin's own folder.
const rel = (path: string) => path.replace(/^.*\/workflow-status\//, '')

const engine = (on: On) => {
  on('command.register', () => ({ value: { command: 'workflow-status' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: undefined }))
  on('fs.exists', (_, e) => ({ value: rel(e.path) in FILES }))
  on('clock.every', () => ({ value: undefined }))
  on('fs.read', (_, e) => {
    const text = FILES[rel(e.path)]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.list', (_, e) =>
    rel(e.path) === '.github/workflows'
      ? { value: [{ name: 'ci.yml', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] }
      : { deny: 'ENOENT' },
  )
  on('skill.prompt', (_, e) => ({ text: e.text }))
}

test('a skill run this session is ticked, others stay open', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.skill.prompt({ skill: 'tdd', text: 'TDD' })
  await $.skill.prompt({ skill: 'tdd', text: 'TDD' })
  await $.skill.prompt({ skill: 'grilling', text: 'grill' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /tdd/ }))?.text).toBe('✓ tdd ×2')
    expect((await ui.find({ type: 'Text', text: /to-spec/ }))?.text).toBe('○ to-spec')
    expect((await ui.find({ type: 'Text', text: /also:/ }))?.text).toBe('also: grilling')
    await ui.unmount()
  }
})

test('the readiness board reports what the repo has and lacks', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Agent readiness/ }))?.text).toBe('Agent readiness 4/9')
  expect((await ui.find({ type: 'Text', text: /AGENTS.md and CLAUDE.md/ }))).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /✗ Issue tracker/ }))).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /1\/16; missing grill-with-docs/ }))).toBeDefined()
  await ui.unmount()
})
