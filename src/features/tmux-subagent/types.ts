export type TmuxConfig = {
  enabled: boolean
  sessionPrefix?: string
}

export type TmuxPane = {
  id: string
  title: string
  threadId: string
}

export const DEFAULT_TMUX_CONFIG: TmuxConfig = {
  enabled: true,
  sessionPrefix: "subagent",
}
