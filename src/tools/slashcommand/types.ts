export interface SlashCommandArgs {
  command: string
  userMessage?: string
}

export interface CommandTemplate {
  name: string
  description: string
  content: string
  path: string
}
