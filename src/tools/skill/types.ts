export interface SkillArgs {
  name: string
}

export interface SkillContent {
  name: string
  description: string
  content: string
  allowedTools?: string[]
}
