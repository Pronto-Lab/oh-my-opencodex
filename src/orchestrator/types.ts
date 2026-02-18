export type CodexEventType =
  | "thread.started"
  | "turn.started"
  | "turn.completed"
  | "turn.failed"
  | "item.started"
  | "item.updated"
  | "item.completed"
  | "error"

export type CodexItemType =
  | "agent_message"
  | "reasoning"
  | "command_execution"
  | "file_change"
  | "mcp_tool_call"
  | "web_search"
  | "todo_list"
  | "error"

export type OhMyCodexEvent =
  | "thread:started"
  | "turn:started"
  | "turn:completed"
  | "turn:failed"
  | "item:started"
  | "item:updated"
  | "item:completed"
  | "file_change:started"
  | "file_change:updated"
  | "file_change:completed"
  | "todo_list:started"
  | "todo_list:updated"
  | "todo_list:completed"
  | "command:started"
  | "command:updated"
  | "command:completed"
  | "mcp_tool:started"
  | "mcp_tool:updated"
  | "mcp_tool:completed"
  | "background:completed"
  | "error"

export type TokenUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

export type ThreadItem = {
  type: CodexItemType
  id?: string
  text?: string
  filePath?: string
  [key: string]: unknown
}

export type EventPayload = {
  "thread:started": { threadId: string }
  "turn:started": Record<string, never>
  "turn:completed": { usage: TokenUsage | null }
  "turn:failed": { error: string }
  "item:started": { item: ThreadItem }
  "item:updated": { item: ThreadItem }
  "item:completed": { item: ThreadItem }
  "file_change:started": { item: ThreadItem }
  "file_change:updated": { item: ThreadItem }
  "file_change:completed": { item: ThreadItem }
  "todo_list:started": { item: ThreadItem }
  "todo_list:updated": { item: ThreadItem }
  "todo_list:completed": { item: ThreadItem }
  "command:started": { item: ThreadItem }
  "command:updated": { item: ThreadItem }
  "command:completed": { item: ThreadItem }
  "mcp_tool:started": { item: ThreadItem }
  "mcp_tool:updated": { item: ThreadItem }
  "mcp_tool:completed": { item: ThreadItem }
  "background:completed": { taskId: string; threadId: string | null; result: string | undefined }
  "error": { message: string }
}

export type BackgroundThread = {
  id: string
  threadId: string | null
  title: string
  status: "running" | "completed" | "failed" | "cancelled"
  startedAt: number
  result?: string
  error?: string
}

export type OrchestratorOptions = {
  workingDirectory: string
  agentName?: string
  prompt?: string
}

export type ContinuationResult = {
  shouldContinue: boolean
  continuationPrompt?: string
}
