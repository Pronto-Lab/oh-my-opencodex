export interface TodoItem {
  content: string
  status: "pending" | "completed"
}

export interface BoulderState {
  todos: TodoItem[]
  retryCount: number
  maxRetries: number
  lastCheckedAt: string
  isActive: boolean
}
