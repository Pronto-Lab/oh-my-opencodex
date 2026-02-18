import type { SessionRecord, SessionStore } from "../../features/session-store"
import type { SessionListToolArgs, SessionReadToolArgs, SessionSearchToolArgs } from "./types"

function formatDate(iso: string): string {
  const value = Date.parse(iso)
  if (Number.isNaN(value)) return "N/A"
  return new Date(value).toISOString().split("T")[0] ?? "N/A"
}

function formatDateTime(iso: string): string {
  const value = Date.parse(iso)
  if (Number.isNaN(value)) return "N/A"
  return new Date(value).toISOString()
}

function formatSessionTable(sessions: SessionRecord[]): string {
  const headers = ["Session ID", "Messages", "First", "Last", "Agent"]
  const rows = sessions.map((session) => [
    session.id,
    String(session.messageCount),
    formatDate(session.createdAt),
    formatDate(session.updatedAt),
    session.agentName || "none",
  ])

  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index].length)))
  const row = (cells: string[]): string => `| ${cells.map((cell, idx) => cell.padEnd(widths[idx])).join(" | ")} |`
  const divider = `|${widths.map((width) => "-".repeat(width + 2)).join("|")}|`

  return [row(headers), divider, ...rows.map(row)].join("\n")
}

export async function sessionList(store: SessionStore, options?: SessionListToolArgs): Promise<string> {
  const sessions = await store.listSessions(options)
  if (sessions.length === 0) return "No sessions found."
  return formatSessionTable(sessions)
}

export async function sessionRead(
  store: SessionStore,
  sessionId: string,
  options?: SessionReadToolArgs,
): Promise<string> {
  const session = await store.getSession(sessionId)
  if (!session) return `Session not found: ${sessionId}`

  const messages = options?.limit && options.limit > 0 ? session.messages.slice(0, options.limit) : session.messages
  const lines: string[] = [
    `Session: ${session.id}`,
    `Messages: ${session.messageCount}`,
    `Date Range: ${formatDateTime(session.createdAt)} to ${formatDateTime(session.updatedAt)}`,
    "",
  ]

  for (const [index, message] of messages.entries()) {
    lines.push(`[Message ${index + 1}] ${message.role} (${formatDateTime(message.timestamp)})`)
    lines.push(message.content)
    lines.push("")
  }

  if (options?.include_todos) {
    lines.push("Note: todo data is not persisted in filesystem session store.")
  }
  if (options?.include_transcript) {
    lines.push("Note: transcript data is not persisted in filesystem session store.")
  }

  return lines.join("\n").trimEnd()
}

export async function sessionSearch(
  store: SessionStore,
  query: string,
  options?: SessionSearchToolArgs,
): Promise<string> {
  const results = await store.searchSessions(query, {
    sessionId: options?.session_id,
    caseSensitive: options?.case_sensitive,
    limit: options?.limit,
  })

  if (results.length === 0) return "No matches found."

  const lines: string[] = [`Found ${results.length} matches:`]
  for (const result of results) {
    lines.push("")
    lines.push(`[${result.sessionId}] Message ${result.messageIndex + 1} (${result.role}) ${formatDateTime(result.timestamp)}`)
    lines.push(result.excerpt)
    lines.push(`Matches: ${result.matchCount}`)
  }

  return lines.join("\n")
}

export async function sessionInfo(store: SessionStore, sessionId: string): Promise<string> {
  const session = await store.getSession(sessionId)
  if (!session) return `Session not found: ${sessionId}`

  const agentsUsed = new Set<string>()
  if (session.agentName) agentsUsed.add(session.agentName)
  const firstMessage = session.messages[0]?.timestamp
  const lastMessage = session.messages[session.messages.length - 1]?.timestamp

  return [
    `Session ID: ${session.id}`,
    `Messages: ${session.messageCount}`,
    `Date Range: ${formatDateTime(firstMessage ?? session.createdAt)} to ${formatDateTime(lastMessage ?? session.updatedAt)}`,
    `Agents Used: ${Array.from(agentsUsed).join(", ") || "none"}`,
    "Has Todos: No",
    "Has Transcript: No",
  ].join("\n")
}
