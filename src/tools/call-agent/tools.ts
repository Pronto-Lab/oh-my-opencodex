import type { BackgroundTask, ThreadPool } from "../../orchestrator/thread-pool"
import type { CallAgentArgs } from "./types"

const POLL_INTERVAL_MS = 100
const DEFAULT_SYNC_TIMEOUT_MS = 120_000

const SUBAGENT_MODEL_MAP: Record<string, string> = {
  oracle: "gpt-5.2",
  explore: "gpt-5-nano",
  librarian: "gpt-5.1",
}

function getModelForSubagent(subagentType: string): string | null {
  const model = SUBAGENT_MODEL_MAP[subagentType.toLowerCase()]
  return model ?? null
}

function buildPrompt(args: CallAgentArgs): string {
  const extra: string[] = []
  if (args.sessionId) {
    extra.push(`sessionId=${args.sessionId}`)
  }
  if (args.loadSkills && args.loadSkills.length > 0) {
    extra.push(`loadSkills=${args.loadSkills.join(",")}`)
  }

  if (extra.length === 0) {
    return args.prompt
  }

  return `${args.prompt}\n\n[context]\n${extra.join("\n")}`
}

async function waitForTaskCompletion(
  pool: ThreadPool,
  taskId: string,
  timeoutMs: number,
): Promise<BackgroundTask | null> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const task = pool.getTask(taskId)
    if (!task) {
      return null
    }
    if (task.status !== "running") {
      return task
    }
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  return pool.getTask(taskId) ?? null
}

export async function callAgent(pool: ThreadPool, args: CallAgentArgs): Promise<string> {
  const model = getModelForSubagent(args.subagentType)
  if (!model) {
    return `Error: unsupported subagentType \"${args.subagentType}\".`
  }

  const taskId = pool.spawn({
    prompt: buildPrompt(args),
    model,
    title: `${args.subagentType}: ${args.description}`,
    description: args.description,
  })

  if (args.runInBackground) {
    return `Background task started: ${taskId}`
  }

  const task = await waitForTaskCompletion(pool, taskId, DEFAULT_SYNC_TIMEOUT_MS)
  if (!task) {
    return `Error: task \"${taskId}\" disappeared before completion.`
  }

  if (task.status === "running") {
    return `Error: task \"${taskId}\" timed out after ${DEFAULT_SYNC_TIMEOUT_MS}ms.`
  }

  if (task.status === "failed") {
    return task.error ? `Task failed: ${task.error}` : "Task failed without error details."
  }

  if (task.status === "cancelled") {
    return `Task \"${taskId}\" was cancelled.`
  }

  return task.result ?? "Task completed with no output."
}
