export type WorkflowStatusRun = { skill: string; count: number; lastAt: number }

export type WorkflowStatusCheck = {
  id: string
  label: string
  isOk: boolean
  detail: string
}

declare module 'claude-code' {
  interface PluginState {
    'workflow-status': {
      runs: WorkflowStatusRun[]
      checks: WorkflowStatusCheck[]
    }
  }
}
