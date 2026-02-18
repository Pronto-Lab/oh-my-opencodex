import type { BackgroundTask, ThreadPool } from "../../orchestrator/thread-pool"
import type { BackgroundCancelArgs, BackgroundOutputArgs } from "./types"

const DEFAULT_WAIT_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 100

function formatTask(task: BackgroundTask, fullSession: boolean): string {
  const lines: string[] = [
    `Task ID: ${task.id}`,
    `Title: ${task.title}`,
    `Status: ${task.status}`,
    `Started: ${new Date(task.startedAt).toISOString()}`,
  ]

  if (typeof task.duration === "number") {
    lines.push(`Duration: ${task.duration}ms`)
  }

  if (task.description) {
    lines.push(`Description: ${task.description}`)
  }

  if (task.result) {
    lines.push("Result:")
    lines.push(task.result)
  }

  if (task.error) {
    lines.push("Error:")
    lines.push(task.error)
  }

  if (fullSession) {
    lines.push("Note: fullSession is not supported for ThreadPool tasks.")
  }

  return lines.join("\n")
}

async function waitForTask(pool: ThreadPool, taskId: string, timeout: number): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    const task = pool.getTask(taskId)
    if (!task || task.status !== "running") {
      return
    }
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

export async function backgroundOutput(pool: ThreadPool, args: BackgroundOutputArgs): Promise<string> {
  const task = pool.getTask(args.taskId)
  if (!task) {
    return `Error: task \"${args.taskId}\" not found.`
  }

  if (args.block && task.status === "running") {
    const timeout = Math.max(1, args.timeout ?? DEFAULT_WAIT_TIMEOUT_MS)
    await waitForTask(pool, args.taskId, timeout)
  }

  const latest = pool.getTask(args.taskId)
  if (!latest) {
    return `Error: task \"${args.taskId}\" no longer exists.`
  }

  const output = formatTask(latest, args.fullSession ?? false)
  if (latest.status === "running" && args.block) {
    return `${output}\nWait timed out before task completion.`
  }

  return output
}

export async function backgroundCancel(pool: ThreadPool, args: BackgroundCancelArgs): Promise<string> {
  if (args.all) {
    const runningTasks = pool.listTasks().filter((task) => task.status === "running")
    pool.cancelAll()
    return `Cancelled ${runningTasks.length} running background task(s).`
  }

  if (!args.taskId) {
    return "Error: provide taskId or set all=true."
  }

  const cancelled = pool.cancel(args.taskId)
  if (!cancelled) {
    return `Task \"${args.taskId}\" is not running or was not found.`
  }

  return `Cancelled task \"${args.taskId}\".`
}
