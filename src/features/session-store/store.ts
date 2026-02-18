import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type {
  SessionListOptions,
  SessionRecord,
  SessionSearchOptions,
  SessionSearchResult,
} from "./types"

const DEFAULT_SEARCH_LIMIT = 20

function countOccurrences(text: string, query: string): number {
  if (!query) return 0
  return text.split(query).length - 1
}

function excerptAroundMatch(originalText: string, searchableText: string, query: string): string {
  const index = searchableText.indexOf(query)
  if (index === -1) return originalText.slice(0, 140)

  const start = Math.max(0, index - 60)
  const end = Math.min(originalText.length, index + query.length + 60)
  const prefix = start > 0 ? "..." : ""
  const suffix = end < originalText.length ? "..." : ""
  return `${prefix}${originalText.slice(start, end)}${suffix}`
}

function normalizeSession(session: SessionRecord): SessionRecord {
  return {
    ...session,
    messageCount: session.messages.length,
  }
}

function parseDateValue(value?: string): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

export class SessionStore {
  private readonly sessionsDir: string

  constructor(dataDir: string) {
    this.sessionsDir = join(dataDir, ".codex", "sessions")
  }

  private getSessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`)
  }

  private async ensureStorageDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true })
  }

  async saveSession(session: SessionRecord): Promise<void> {
    await this.ensureStorageDir()
    const now = new Date().toISOString()
    const normalized = normalizeSession({
      ...session,
      createdAt: session.createdAt || now,
      updatedAt: now,
    })
    await writeFile(this.getSessionPath(normalized.id), JSON.stringify(normalized, null, 2), "utf-8")
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    try {
      const raw = await readFile(this.getSessionPath(id), "utf-8")
      return normalizeSession(JSON.parse(raw) as SessionRecord)
    } catch {
      return null
    }
  }

  async listSessions(options?: SessionListOptions): Promise<SessionRecord[]> {
    try {
      const files = await readdir(this.sessionsDir)
      const sessions: SessionRecord[] = []

      for (const file of files) {
        if (!file.endsWith(".json")) continue
        const id = file.slice(0, -5)
        const session = await this.getSession(id)
        if (!session) continue
        sessions.push(session)
      }

      const fromTs = parseDateValue(options?.from_date)
      const toTs = parseDateValue(options?.to_date)

      const filtered = sessions.filter((session) => {
        const updatedAt = parseDateValue(session.updatedAt)
        if (updatedAt === null) return false
        if (fromTs !== null && updatedAt < fromTs) return false
        if (toTs !== null && updatedAt > toTs) return false
        return true
      })

      filtered.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

      if (options?.limit && options.limit > 0) {
        return filtered.slice(0, options.limit)
      }

      return filtered
    } catch {
      return []
    }
  }

  async searchSessions(query: string, options?: SessionSearchOptions): Promise<SessionSearchResult[]> {
    const limit = options?.limit && options.limit > 0 ? options.limit : DEFAULT_SEARCH_LIMIT
    const caseSensitive = options?.caseSensitive ?? false
    const normalizedQuery = caseSensitive ? query : query.toLowerCase()

    if (!normalizedQuery.trim()) return []

    const sessions = options?.sessionId
      ? [await this.getSession(options.sessionId)].filter((session): session is SessionRecord => Boolean(session))
      : await this.listSessions()

    const results: SessionSearchResult[] = []

    for (const session of sessions) {
      for (const [messageIndex, message] of session.messages.entries()) {
        if (results.length >= limit) return results

        const searchable = caseSensitive ? message.content : message.content.toLowerCase()
        const matchCount = countOccurrences(searchable, normalizedQuery)
        if (matchCount === 0) continue

        results.push({
          sessionId: session.id,
          messageIndex,
          role: message.role,
          excerpt: excerptAroundMatch(message.content, searchable, normalizedQuery),
          matchCount,
          timestamp: message.timestamp,
        })
      }
    }

    return results
  }

  async deleteSession(id: string): Promise<void> {
    await rm(this.getSessionPath(id), { force: true })
  }
}
