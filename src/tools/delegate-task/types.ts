export type DelegateTaskArgs = {
  description: string
  prompt: string
  category?: string
  subagentType?: string
  skills?: string[]
  runInBackground?: boolean
  sessionId?: string
  command?: string
}

export type CategoryResolution = {
  model: string
  reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh"
  description: string
}
