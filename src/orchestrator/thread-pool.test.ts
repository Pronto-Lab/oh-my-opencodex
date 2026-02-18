import { describe, expect, it } from "bun:test"
import { ThreadPool } from "./thread-pool"

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition")
    }
    await Bun.sleep(10)
  }
}

describe("ThreadPool", () => {
  it("spawns, completes, and lists background tasks", async () => {
    const pool = new ThreadPool({ maxConcurrent: 2 })
    const internals = pool as unknown as {
      runTask: (prompt: string, model?: string) => Promise<string>
    }
    internals.runTask = async (prompt: string) => `done:${prompt}`

    const firstId = pool.spawn({ prompt: "first", title: "Task 1" })
    const secondId = pool.spawn({ prompt: "second", title: "Task 2" })

    await waitFor(() => {
      const tasks = pool.listTasks()
      return tasks.length === 2 && tasks.every((task) => task.status === "completed")
    })

    const tasks = pool.listTasks()
    expect(tasks.map((task) => task.id).sort()).toEqual([firstId, secondId].sort())
    expect(tasks.every((task) => task.status === "completed")).toBe(true)
  })

  it("cancels queued tasks before execution", async () => {
    const pool = new ThreadPool({ maxConcurrent: 1 })
    let releaseFirst: (() => void) | null = null

    const internals = pool as unknown as {
      runTask: (prompt: string, model?: string) => Promise<string>
    }
    internals.runTask = async (prompt: string, model?: string) => {
      await new Promise<void>((resolve) => {
        releaseFirst = resolve
      })
      return `done:${prompt}:${model ?? "default"}`
    }

    const firstId = pool.spawn({ prompt: "first" })
    const secondId = pool.spawn({ prompt: "second" })

    await waitFor(() => pool.getRunningCount() === 1)

    expect(pool.cancel(secondId)).toBe(true)
    releaseFirst?.()

    await waitFor(() => {
      const tasks = pool.listTasks()
      const first = tasks.find((task) => task.id === firstId)
      const second = tasks.find((task) => task.id === secondId)
      return first?.status === "completed" && second?.status === "cancelled"
    })

    const first = pool.getTask(firstId)
    const second = pool.getTask(secondId)
    expect(first?.status).toBe("completed")
    expect(second?.status).toBe("cancelled")
  })

  it("honors max concurrent limit", async () => {
    const pool = new ThreadPool({ maxConcurrent: 2 })
    let currentRunning = 0
    let maxSeen = 0

    const internals = pool as unknown as {
      runTask: (prompt: string, model?: string) => Promise<string>
    }
    internals.runTask = async (prompt: string) => {
      currentRunning += 1
      maxSeen = Math.max(maxSeen, currentRunning)
      await Bun.sleep(30)
      currentRunning -= 1
      return `ok:${prompt}`
    }

    for (let i = 0; i < 5; i += 1) {
      pool.spawn({ prompt: `task-${i}` })
    }

    await waitFor(() => {
      const tasks = pool.listTasks()
      return tasks.length === 5 && tasks.every((task) => task.status === "completed")
    }, 4000)

    expect(maxSeen).toBeLessThanOrEqual(2)
  })
})
