export interface CallAgentArgs {
  prompt: string
  subagentType: string
  description: string
  runInBackground: boolean
  sessionId?: string
  loadSkills?: string[]
}
