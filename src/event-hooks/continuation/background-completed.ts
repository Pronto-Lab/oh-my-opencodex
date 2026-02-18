import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import type { EventPayload } from "../../orchestrator/types"
import type { HookRegistry } from "../hook-registry"

const HOOK_NAME = "background-completed"

type PendingBackgroundNotification = {
  taskId: string
  description: string
  completedAt: number
}

const pendingQueue: PendingBackgroundNotification[] = []

function toDescription(payload: EventPayload["background:completed"]): string {
  const trimmedResult = payload.result?.trim()
  if (trimmedResult && trimmedResult.length > 0) {
    return trimmedResult
  }

  return "Background task finished"
}

function toDurationText(completedAt: number): string {
  const elapsedMs = Math.max(0, Date.now() - completedAt)
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`
  }

  return `${(elapsedMs / 1000).toFixed(1)}s`
}

export function createBackgroundCompletedHook(
  _config: OhMyCodexConfig,
  _workingDir: string,
  registry: HookRegistry,
): void {
  registry.register(
    HOOK_NAME,
    "background:completed",
    (payload) => {
      pendingQueue.push({
        taskId: payload.taskId,
        description: toDescription(payload),
        completedAt: Date.now(),
      })
    },
    100,
  )

  registry.registerContinuation(
    HOOK_NAME,
    () => {
      const next = pendingQueue.shift()
      if (!next) {
        return { shouldContinue: false }
      }

      return {
        shouldContinue: true,
        continuationPrompt:
          `[BACKGROUND TASK COMPLETED] ID: ${next.taskId} ` +
          `Description: ${next.description} Duration: ${toDurationText(next.completedAt)}`,
      }
    },
    200,
  )
}
