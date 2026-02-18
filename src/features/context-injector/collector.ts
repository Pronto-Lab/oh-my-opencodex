import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ContextResource, ThreadPoolLike, TodoWatcherLike } from "./types"

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8")
  } catch {
    return null
  }
}

async function collectRulesContent(workingDir: string): Promise<string> {
  const rulesDir = join(workingDir, ".codex", "rules")

  try {
    const entries = await readdir(rulesDir, { withFileTypes: true })
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))

    if (files.length === 0) {
      return ""
    }

    const chunks: string[] = []
    for (const fileName of files) {
      const content = await readOptionalFile(join(rulesDir, fileName))
      if (!content) {
        continue
      }

      chunks.push(`# ${fileName}\n\n${content.trim()}`)
    }

    return chunks.join("\n\n---\n\n")
  } catch {
    return ""
  }
}

export async function collectProjectContext(workingDir: string): Promise<ContextResource[]> {
  const resources: ContextResource[] = []

  const agentsMd = await readOptionalFile(join(workingDir, "AGENTS.md"))
  if (agentsMd) {
    resources.push({
      uri: "project://agents-md",
      name: "AGENTS.md",
      description: "Project execution guidelines and agent instructions",
      content: agentsMd,
    })
  }

  const readme = await readOptionalFile(join(workingDir, "README.md"))
  if (readme) {
    resources.push({
      uri: "project://readme",
      name: "README.md",
      description: "Project overview and usage documentation",
      content: readme,
    })
  }

  const rules = await collectRulesContent(workingDir)
  if (rules) {
    resources.push({
      uri: "project://rules",
      name: "Codex Rules",
      description: "Merged .codex/rules content",
      content: rules,
    })
  }

  return resources
}

export function collectSessionContext(
  threadPool: ThreadPoolLike,
  todoWatcher: TodoWatcherLike,
): ContextResource[] {
  const todos = todoWatcher.getIncompleteTodos()
  const tasks = threadPool.listTasks()

  const todoContent = todos.length
    ? todos.map((todo) => `- [${todo.status}] ${todo.content}`).join("\n")
    : "No active todos"

  const backgroundContent = tasks.length
    ? tasks
        .map((task) => `- ${task.id} | ${task.status} | ${task.title} | ${task.description}`)
        .join("\n")
    : "No background tasks"

  return [
    {
      uri: "session://todos",
      name: "Todo State",
      description: "Current todo watcher state",
      content: todoContent,
    },
    {
      uri: "session://background",
      name: "Background Task Status",
      description: "Current background task state from thread pool",
      content: backgroundContent,
    },
  ]
}
