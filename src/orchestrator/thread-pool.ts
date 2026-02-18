import type { HookRegistry } from "../event-hooks/hook-registry"
import { log } from "../shared/logger"
import type { CodexWrapper } from "./codex-wrapper"

const DEFAULT_MAX_CONCURRENT = 5
const MAX_HISTORY_SIZE = 50

export type BackgroundTask = {
  id: string
  title: string
  description: string
  status: "running" | "completed" | "failed" | "cancelled"
  result?: string
  error?: string
  startedAt: number
  completedAt?: number
  duration?: number
}

type SpawnOptions = {
  prompt: string
  model?: string
  title?: string
  description?: string
}

type TaskRuntime = {
  prompt: string
  model?: string
}

export class ThreadPool {
  private codexWrapper: CodexWrapper | null = null
  private hookRegistry: HookRegistry | null = null
  private readonly maxConcurrent: number
  private readonly activeTasks = new Map<string, BackgroundTask>()
  private readonly taskRuntime = new Map<string, TaskRuntime>()
  private readonly runningTaskIds = new Set<string>()
  private readonly pendingTaskIds: string[] = []
  private readonly history: BackgroundTask[] = []

  constructor(options: { maxConcurrent?: number } = {}) {
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT)
  }

  setCodexWrapper(wrapper: CodexWrapper): void {
    this.codexWrapper = wrapper
  }

  setHookRegistry(hookRegistry: HookRegistry): void {
    this.hookRegistry = hookRegistry
  }
  spawn(options: SpawnOptions): string {
    const taskId = this.createTaskId()
    const now = Date.now()
    const task: BackgroundTask = {
      id: taskId,
      title: options.title ?? `Background task ${taskId}`,
      description: options.description ?? options.prompt,
      status: "running",
      startedAt: now,
    }

    this.activeTasks.set(taskId, task)
    this.taskRuntime.set(taskId, { prompt: options.prompt, model: options.model })
    this.pendingTaskIds.push(taskId)
    log("ThreadPool spawn", { taskId, model: options.model, queueSize: this.pendingTaskIds.length })
    void this.processQueue()
    return taskId
  }
  getTask(taskId: string): BackgroundTask | undefined {
    return this.activeTasks.get(taskId) ?? this.history.find((task) => task.id === taskId)
  }

  listTasks(): BackgroundTask[] {
    return [...this.activeTasks.values(), ...this.history]
  }
  cancel(taskId: string): boolean {
    const task = this.activeTasks.get(taskId)
    if (!task || task.status !== "running") {
      return false
    }

    task.status = "cancelled"
    task.completedAt = Date.now()
    task.duration = task.completedAt - task.startedAt

    const queueIndex = this.pendingTaskIds.indexOf(taskId)
    if (queueIndex !== -1 && !this.runningTaskIds.has(taskId)) {
      this.pendingTaskIds.splice(queueIndex, 1)
      this.archiveTask(task)
    }

    log("ThreadPool cancelled task", { taskId })
    return true
  }
  cancelAll(): void {
    for (const taskId of Array.from(this.activeTasks.keys())) {
      this.cancel(taskId)
    }
  }

  getRunningCount(): number {
    return this.runningTaskIds.size
  }
  private async processQueue(): Promise<void> {
    while (this.runningTaskIds.size < this.maxConcurrent && this.pendingTaskIds.length > 0) {
      const nextTaskId = this.pendingTaskIds.shift()
      if (!nextTaskId) {
        return
      }

      const task = this.activeTasks.get(nextTaskId)
      if (!task || task.status === "cancelled") {
        continue
      }

      this.runningTaskIds.add(nextTaskId)

      void this.executeTask(nextTaskId).finally(() => {
        this.runningTaskIds.delete(nextTaskId)
        void this.processQueue()
      })
    }
  }
  private async executeTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId)
    const runtime = this.taskRuntime.get(taskId)
    if (!task || !runtime || task.status === "cancelled") {
      return
    }

    try {
      const result = await this.runTask(runtime.prompt, runtime.model)
      if (this.isCancelled(taskId)) {
        this.archiveTask(task)
        return
      }

      task.status = "completed"
      task.result = result
      task.completedAt = Date.now()
      task.duration = task.completedAt - task.startedAt
      this.archiveTask(task)
      await this.emitCompleted(task.id, task.result)
    } catch (error) {
      if (this.isCancelled(taskId)) {
        this.archiveTask(task)
        return
      }

      task.status = "failed"
      task.error = error instanceof Error ? error.message : String(error)
      task.completedAt = Date.now()
      task.duration = task.completedAt - task.startedAt
      this.archiveTask(task)
      await this.emitCompleted(task.id, undefined)
    }
  }
  private async runTask(prompt: string, model?: string): Promise<string> {
    if (!this.codexWrapper) {
      throw new Error("CodexWrapper not set on ThreadPool")
    }

    const resolvedModel = model ?? this.codexWrapper.resolveModel()
    log("ThreadPool runTask", { model: resolvedModel, promptLength: prompt.length })

    const thread = this.codexWrapper.createThread({ model: resolvedModel })
    const turn = await thread.run(prompt)
    return turn.finalResponse
  }
  private async emitCompleted(taskId: string, result: string | undefined): Promise<void> {
    if (!this.hookRegistry) {
      return
    }

    await this.hookRegistry.emit("background:completed", {
      taskId,
      threadId: null,
      result,
    })
  }
  private archiveTask(task: BackgroundTask): void {
    this.activeTasks.delete(task.id)
    this.taskRuntime.delete(task.id)
    this.history.unshift({ ...task })
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.length = MAX_HISTORY_SIZE
    }
  }

  private isCancelled(taskId: string): boolean {
    return this.activeTasks.get(taskId)?.status === "cancelled"
  }

  private createTaskId(): string {
    const randomHex = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0")
    return `bg_${randomHex}`
  }
}
