export interface BuiltinSkillMcpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export type BuiltinSkillMcpConfig = Record<string, BuiltinSkillMcpServer>

export interface BuiltinSkill {
  name: string
  description: string
  content: string
  allowedTools?: string[]
  mcpConfig?: BuiltinSkillMcpConfig
}
