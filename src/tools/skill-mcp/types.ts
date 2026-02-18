export interface SkillMcpArgs {
  mcpName: string
  toolName?: string
  resourceName?: string
  promptName?: string
  arguments?: string | Record<string, unknown>
  grep?: string
}

export interface SkillMcpRuntimeContext {
  workingDirectory?: string
  sessionID?: string
}
