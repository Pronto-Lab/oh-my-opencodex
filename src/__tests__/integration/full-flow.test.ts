import { afterEach, describe, expect, it, mock } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOrchestrator, runSession } from "../../orchestrator/orchestrator"

mock.module("@openai/codex-sdk", () => ({
  Codex: class MockCodex {},
  Thread: class MockThread {},
  StreamedTurn: class MockStreamedTurn {},
}))

type MockStream = { events: AsyncGenerator<unknown> }
type MockThread = {
  id: string | null
  run: (input: string) => Promise<{ items: unknown[]; finalResponse: string; usage: unknown }>
  runStreamed: (input: string) => Promise<MockStream>
}

const tempDirs = new Set<string>()

async function newTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "omc-integration-"))
  tempDirs.add(dir)
  return dir
}

async function writeConfig(workingDirectory: string, body: string): Promise<void> {
  await mkdir(path.join(workingDirectory, ".codex"), { recursive: true })
  await writeFile(path.join(workingDirectory, ".codex", "oh-my-opencodex.jsonc"), body, "utf-8")
}

async function* eventStream(events: unknown[]): AsyncGenerator<unknown> {
  for (const event of events) {
    yield event
  }
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  tempDirs.clear()
})

describe("integration/full-flow", () => {
  it("loads JSONC config and assembles orchestrator context", async () => {
    const workingDirectory = await newTempDir()
    await writeConfig(
      workingDirectory,
      JSON.stringify({
        default_agent: "atlas",
        disabled_hooks: ["turn-started-hook", "turn-completed-hook", "turn-failed-hook"],
      }, null, 2),
    )

    const context = await createOrchestrator({ workingDirectory })
    const codexToml = await readFile(path.join(workingDirectory, ".codex", "config.toml"), "utf-8")

    expect(context.workingDirectory).toBe(workingDirectory)
    expect(context.wrapper.resolveModel()).toBe("gpt-5.1")
    expect(context.hookRegistry.getRegisteredHooks().length).toBeGreaterThan(0)
    expect(codexToml.includes("[permissions]")).toBe(true)
    expect(codexToml.includes("[mcp_servers.oh-my-opencodex]")).toBe(true)
  })

  it("runs event stream and emits hooks in event-loop order", async () => {
    const workingDirectory = await newTempDir()
    await writeConfig(workingDirectory, JSON.stringify({ disabled_hooks: [] }))
    const context = await createOrchestrator({ workingDirectory })

    const observed: string[] = []
    context.hookRegistry.register("test-thread", "thread:started", () => {
      observed.push("thread:started")
    }, -100)
    context.hookRegistry.register("test-turn", "turn:started", () => {
      observed.push("turn:started")
    }, -100)
    context.hookRegistry.register("test-item", "item:completed", () => {
      observed.push("item:completed")
    }, -100)
    context.hookRegistry.register("test-command", "command:completed", () => {
      observed.push("command:completed")
    }, -100)
    context.hookRegistry.register("test-done", "turn:completed", () => {
      observed.push("turn:completed")
    }, -100)
    context.hookRegistry.registerContinuation("test-stop", () => ({ shouldContinue: false }), -100)

    const thread: MockThread = {
      id: "thread-one",
      run: async () => ({ items: [], finalResponse: "ok", usage: {} }),
      runStreamed: async () => ({
        events: eventStream([
          { type: "thread.started", thread_id: "thread-one" },
          { type: "turn.started" },
          { type: "item.completed", item: { type: "command_execution", id: "item-1" } },
          { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } },
        ]),
      }),
    }

    const internalWrapper = context.wrapper as unknown as {
      codex: { startThread: () => MockThread }
      primaryThread: MockThread | null
    }
    internalWrapper.codex = { startThread: () => thread }
    internalWrapper.primaryThread = null

    await runSession(context, "hello")

    expect(observed).toEqual([
      "thread:started",
      "turn:started",
      "item:completed",
      "command:completed",
      "turn:completed",
    ])
  })

  it("continues turns when continuation hook requests boulder retry", async () => {
    const workingDirectory = await newTempDir()
    await writeConfig(workingDirectory, JSON.stringify({ disabled_hooks: [] }))
    const context = await createOrchestrator({ workingDirectory })

    const prompts: string[] = []
    const streams: MockStream[] = [
      { events: eventStream([{ type: "turn.started" }, { type: "turn.completed", usage: null }]) },
      { events: eventStream([{ type: "turn.started" }, { type: "turn.completed", usage: null }]) },
    ]
    const thread: MockThread = {
      id: "thread-retry",
      run: async () => ({ items: [], finalResponse: "ok", usage: {} }),
      runStreamed: async (input: string) => {
        prompts.push(input)
        const next = streams.shift()
        if (!next) {
          throw new Error("No more streams")
        }
        return next
      },
    }

    const internalWrapper = context.wrapper as unknown as {
      codex: { startThread: () => MockThread }
      primaryThread: MockThread | null
    }
    internalWrapper.codex = { startThread: () => thread }
    internalWrapper.primaryThread = null

    let continuationChecks = 0
    context.hookRegistry.registerContinuation(
      "boulder",
      () => {
        continuationChecks += 1
        if (continuationChecks === 1) {
          return { shouldContinue: true, continuationPrompt: "keep going" }
        }
        return { shouldContinue: false }
      },
      -100,
    )

    await runSession(context, "start")

    expect(prompts).toEqual(["start", "keep going"])
    expect(continuationChecks).toBe(2)
  })
})
