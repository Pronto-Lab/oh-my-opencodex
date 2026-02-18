import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { EventPayload } from "../../orchestrator/types"
import { executeCommand } from "../../shared/command-executor"
import { log } from "../../shared/logger"

const COMMENT_CHECKER_EVENT = "file_change:completed"
const COMMENT_CHECKER_PRIORITY = 100

type FileChangeOperation = "create" | "modify" | "delete"
type FileChangeItem = {
  filePath?: string
  filePaths?: unknown
  operation?: FileChangeOperation
}

function toFileChangeItem(item: EventPayload["file_change:completed"]["item"]): FileChangeItem {
  return item as FileChangeItem
}

function toFilePathList(item: FileChangeItem): string[] {
  if (Array.isArray(item.filePaths)) {
    return item.filePaths.filter((path): path is string => typeof path === "string")
  }

  if (typeof item.filePath === "string") {
    return [item.filePath]
  }

  return []
}

function hasViolation(output: string): boolean {
  const normalized = output.toLowerCase()
  if (normalized.length === 0) {
    return false
  }

  const cleanSignals = [
    "no ai-generated comments",
    "no ai comments",
    "no violations",
    "clean",
  ]

  if (cleanSignals.some((signal) => normalized.includes(signal))) {
    return false
  }

  const violationSignals = ["violation", "detected", "ai-generated", "needs fix"]
  return violationSignals.some((signal) => normalized.includes(signal))
}

export function createFileChangeCheckerHook(config?: OhMyOpenCodexConfig): {
  event: "file_change:completed"
  handler: (payload: EventPayload["file_change:completed"]) => Promise<void>
  priority: number
} {
  return {
    event: COMMENT_CHECKER_EVENT,
    priority: COMMENT_CHECKER_PRIORITY,
    handler: async (payload) => {
      const item = toFileChangeItem(payload.item)
      if (item.operation === "delete") {
        return
      }

      const filePaths = toFilePathList(item)
      for (const filePath of filePaths) {
        const command = `bunx @code-yeongyu/comment-checker ${JSON.stringify(filePath)}`
        const output = await executeCommand(command)

        if (!hasViolation(output)) {
          continue
        }

        log("[item-hook:file-change-checker] Comment violations detected", {
          filePath,
          output,
        })

        if (config?.comment_checker?.auto_fix) {
          log("[item-hook:file-change-checker] Auto-fix requested", {
            filePath,
          })
        }
      }
    },
  }
}
