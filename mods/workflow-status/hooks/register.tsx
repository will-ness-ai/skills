import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { WorkflowStatusCheck, WorkflowStatusRun } from '../types'

const PANE = 'workflow-status'
const TITLE = 'Workflow'
const LOCK = '.claude/will-ness-skills.lock.json'

// The steps of docs/agents/DEVELOPMENT_WORKFLOW.md, in the order work moves
// through them. Keep in step with skills/setup-will-ness-skills.
const WORKFLOW = [
  'grill-with-docs',
  'prototype',
  'grill-design',
  'codebase-design',
  'to-spec',
  'to-tickets',
  'implement-spec',
  'tdd',
  'code-review',
  'pr',
  'retro',
]

// What install-skills.sh installs; the lock file, when present, wins.
const INSTALLED_BY_DEFAULT = [
  ...WORKFLOW,
  'grilling',
  'domain-modeling',
  'writing-for-agents',
  'setup-matt-pocock-skills',
  'maintain-agents-md',
]

const AGENTS_MD_MAX_LINES = 150

const runs = atom({ plugin: 'workflow-status', key: 'runs' } as const, [])
const checks = atom({ plugin: 'workflow-status', key: 'checks' } as const, [])

type $ = EngineInterface

const exists = ($: $, path: string) => $.fs.exists(path).catch(() => false)

const firstThatExists = async ($: $, paths: string[]) => {
  for (const path of paths) {
    if (await exists($, path)) return path
  }
  return undefined
}

const expectedSkills = async ($: $): Promise<string[]> => {
  const text = await $.fs.read(LOCK).catch(() => undefined)
  if (text === undefined) return INSTALLED_BY_DEFAULT
  try {
    const lock = JSON.parse(text) as { skills?: { name?: unknown }[] }
    const names = (lock.skills ?? []).map(s => s.name).filter(n => typeof n === 'string')
    return names.length > 0 ? (names as string[]) : INSTALLED_BY_DEFAULT
  } catch {
    return INSTALLED_BY_DEFAULT
  }
}

const check = (id: string, label: string, isOk: boolean, detail: string): WorkflowStatusCheck => ({
  id,
  label,
  isOk,
  detail,
})

// Paths are relative to the session's working directory: run Claude from the
// repo root for an accurate board.
const survey = async ($: $): Promise<WorkflowStatusCheck[]> => {
  const home = await $.env.get('HOME')
  const out: WorkflowStatusCheck[] = []

  const hasAgents = await exists($, 'AGENTS.md')
  const hasClaude = await exists($, 'CLAUDE.md')
  const agentsFile = hasAgents ? 'AGENTS.md' : hasClaude ? 'CLAUDE.md' : undefined
  out.push(
    check(
      'agents-md',
      'AGENTS.md',
      hasAgents && hasClaude,
      hasAgents && hasClaude
        ? 'AGENTS.md and CLAUDE.md both resolve'
        : agentsFile
          ? `only ${agentsFile}; link the other name to it`
          : 'missing; run maintain-agents-md',
    ),
  )

  if (agentsFile) {
    const text = await $.fs.read(agentsFile).catch(() => '')
    const lines = text.split('\n').length
    out.push(
      check(
        'agents-md-lean',
        'AGENTS.md is lean',
        lines <= AGENTS_MD_MAX_LINES,
        `${lines} lines (budget ${AGENTS_MD_MAX_LINES})`,
      ),
    )
  }

  const workflowDoc = await firstThatExists($, [
    'docs/agents/DEVELOPMENT_WORKFLOW.md',
    'DEVELOPMENT_WORKFLOW.md',
    'docs/DEVELOPMENT_WORKFLOW.md',
  ])
  out.push(check('workflow-doc', 'Workflow doc', workflowDoc !== undefined, workflowDoc ?? 'missing; run /setup-will-ness-skills'))

  const tracker = await exists($, 'docs/agents/issue-tracker.md')
  out.push(
    check('issue-tracker', 'Issue tracker configured', tracker, tracker ? 'docs/agents/issue-tracker.md' : 'run /setup-matt-pocock-skills'),
  )

  const glossary = await firstThatExists($, ['GLOSSARY.md', 'CONTEXT.md', 'CONTEXT-MAP.md'])
  out.push(check('glossary', 'Domain glossary', glossary !== undefined, glossary ?? 'none yet; /grill-with-docs starts one'))

  const expected = await expectedSkills($)
  const missing: string[] = []
  for (const name of expected) {
    const places = [`.claude/skills/${name}/SKILL.md`, `.agents/skills/${name}/SKILL.md`]
    if (home) places.push(`${home}/.claude/skills/${name}/SKILL.md`)
    if ((await firstThatExists($, places)) === undefined) missing.push(name)
  }
  out.push(
    check(
      'skills',
      'Workflow skills',
      missing.length === 0,
      missing.length === 0
        ? `${expected.length}/${expected.length} installed`
        : `${expected.length - missing.length}/${expected.length}; missing ${missing.join(', ')}`,
    ),
  )

  const settings = await $.fs.read('.claude/settings.json').catch(() => '')
  const guardrails = [
    /"hooks"\s*:/.test(settings) ? 'Claude hooks' : undefined,
    await firstThatExists($, ['.husky', '.pre-commit-config.yaml', 'lefthook.yml', '.lefthook.yml', '.git/hooks/pre-commit']),
  ].filter(Boolean)
  out.push(
    check('hooks', 'Hooks', guardrails.length > 0, guardrails.length > 0 ? guardrails.join(', ') : 'no Claude hooks or pre-commit hook'),
  )

  const ciDir = await $.fs.list('.github/workflows').catch(() => [])
  const ci = ciDir.some(f => /\.ya?ml$/.test(f.name))
    ? '.github/workflows'
    : await firstThatExists($, ['.gitlab-ci.yml', '.circleci/config.yml', 'azure-pipelines.yml'])
  out.push(check('ci', 'CI', ci !== undefined, ci ?? 'no CI config found'))

  const standards = await firstThatExists($, ['CODING_STANDARDS.md', 'docs/agents/CODING_STANDARDS.md', 'docs/CODING_STANDARDS.md'])
  out.push(check('standards', 'Coding standards', standards !== undefined, standards ?? 'none; /retro adds rules as they come up'))

  return out
}

let pending: { cancel: () => void } | undefined

const refresh = async ($: $) => {
  const next = await survey($)
  await update($, checks, () => next)
}

const refreshSoon = ($: $) => {
  pending?.cancel()
  pending = $.clock.after(1500, () => void refresh($))
}

const openPane = ($: $) => $.ui.open({ id: PANE, title: TITLE })

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'workflow-status',
      description: 'Open the workflow status pane',
    })
    await refresh($)
    $.clock.every(60_000, () => void refresh($))
    // Beside the chat in the apps, which draw a pane as a sidebar; in a
    // terminal it would open inline, so there it waits for /workflow-status.
    if (e.surface !== 'terminal') void openPane($)

    return next(e)
  })

  on('command.run', { command: 'workflow-status' }, async $ => {
    await refresh($)
    await openPane($)

    return { text: 'Workflow status pane opened.' }
  })

  // Every way a skill reaches the model: typed as /name, the Skill tool, or a
  // subagent's preload.
  on('skill.prompt', async ($, e, next) => {
    const at = Date.now()
    await update($, runs, list => {
      const seen = list.find(r => r.skill === e.skill)
      return seen
        ? list.map(r => (r.skill === e.skill ? { ...r, count: r.count + 1, lastAt: at } : r))
        : [...list, { skill: e.skill, count: 1, lastAt: at }]
    })

    return next(e)
  })

  // A file the board reads may have changed.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit'].includes(String(e.tool))) refreshSoon($)

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const ran: WorkflowStatusRun[] = await read($, runs)
    const board: WorkflowStatusCheck[] = await read($, checks)
    const byName = new Map(ran.map(r => [r.skill, r]))
    const others = ran.filter(r => !WORKFLOW.includes(r.skill))
    const ready = board.filter(c => c.isOk).length

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>This session</Text>
          {WORKFLOW.map(skill => {
            const run = byName.get(skill)
            return run ? (
              <Text color="success">
                ✓ {skill}
                {run.count > 1 ? ` ×${run.count}` : ''}
              </Text>
            ) : (
              <Text dimColor>○ {skill}</Text>
            )
          })}
          {others.length > 0 && (
            <Text dimColor>
              also: {others.map(r => (r.count > 1 ? `${r.skill} ×${r.count}` : r.skill)).join(', ')}
            </Text>
          )}
        </Box>
        <Box flexDirection="column">
          <Text bold>
            Agent readiness {board.length > 0 ? `${ready}/${board.length}` : ''}
          </Text>
          {board.map(c => (
            <Box flexDirection="column">
              <Text color={c.isOk ? 'success' : 'warning'}>
                {c.isOk ? '✓' : '✗'} {c.label}
              </Text>
              <Text dimColor wrap="truncate-end">
                {'  '}
                {c.detail}
              </Text>
            </Box>
          ))}
        </Box>
        <Button key="refresh" label="Refresh" onPress={() => void refresh($)} />
      </Box>
    )
  })
}
