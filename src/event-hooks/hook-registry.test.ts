import { describe, expect, it } from "bun:test"
import { HookRegistry } from "./hook-registry"

describe("HookRegistry", () => {
  it("emits handlers in priority order for registered events", async () => {
    const registry = new HookRegistry()
    const callOrder: string[] = []

    registry.register(
      "later",
      "turn:started",
      async () => {
        callOrder.push("later")
      },
      200,
    )
    registry.register(
      "earlier",
      "turn:started",
      async () => {
        callOrder.push("earlier")
      },
      100,
    )

    await registry.emit("turn:started", {})

    expect(callOrder).toEqual(["earlier", "later"])
  })

  it("supports typed payload dispatch", async () => {
    const registry = new HookRegistry()
    let threadId = ""

    registry.register("thread-hook", "thread:started", async (payload) => {
      threadId = payload.threadId
    })

    await registry.emit("thread:started", { threadId: "thread-1" })

    expect(threadId).toBe("thread-1")
  })

  it("registers continuation hooks and short-circuits on first continuation", async () => {
    const registry = new HookRegistry()
    const calls: string[] = []

    registry.registerContinuation(
      "first",
      async () => {
        calls.push("first")
        return { shouldContinue: false }
      },
      100,
    )
    registry.registerContinuation(
      "second",
      async () => {
        calls.push("second")
        return {
          shouldContinue: true,
          continuationPrompt: "continue",
        }
      },
      200,
    )
    registry.registerContinuation(
      "third",
      async () => {
        calls.push("third")
        return { shouldContinue: false }
      },
      300,
    )

    const result = await registry.checkContinuation({ usage: null })

    expect(result).toEqual({ shouldContinue: true, continuationPrompt: "continue" })
    expect(calls).toEqual(["first", "second"])
  })

  it("skips hooks listed in disabled hooks", async () => {
    const registry = new HookRegistry(["disabled-hook", "disabled-continuation"])
    let called = false

    registry.register("disabled-hook", "turn:started", async () => {
      called = true
    })
    registry.register("enabled-hook", "turn:started", async () => {
      called = true
    })
    registry.registerContinuation("disabled-continuation", async () => ({
      shouldContinue: true,
      continuationPrompt: "never",
    }))

    await registry.emit("turn:started", {})
    const continuation = await registry.checkContinuation({ usage: null })

    expect(called).toBe(true)
    expect(registry.getRegisteredHooks()).toContain("enabled-hook")
    expect(registry.getRegisteredHooks()).not.toContain("disabled-hook")
    expect(continuation).toEqual({ shouldContinue: false })
  })
})
