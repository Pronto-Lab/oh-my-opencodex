export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string
  timestamp: string
}

export interface SessionRecord {
  id: string
  messages: SessionMessage[]
  createdAt: string
  updatedAt: string
  agentName: string
  messageCount: number
}

export interface SessionSearchResult {
  sessionId: string
  messageIndex: number
  role: SessionMessage["role"]
  excerpt: string
  matchCount: number
  timestamp: string
}

export interface SessionListOptions {
  limit?: number
  from_date?: string
  to_date?: string
}

export interface SessionSearchOptions {
  sessionId?: string
  caseSensitive?: boolean
  limit?: number
}
