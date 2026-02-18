import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import type { SessionStore } from "../features/session-store"
import type { ThreadPool } from "../orchestrator/thread-pool"

export type McpToolContext = {
  workingDirectory: string
  config: OhMyCodexConfig
  disabledTools: Set<string>
  sessionStore: SessionStore
  threadPool: ThreadPool
}

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>
  isError?: boolean
}

export type RegisteredToolInfo = {
  name: string
  title: string
  description: string
}
