import { describe, expect, it } from "bun:test"
import { EventLoop } from "./event-loop"

async function* toEvents(events: unknown[]): AsyncGenerator<unknown> {
  for (const event of events) {
    yield event
  }
}

describe("EventLoop", () => {
  it("dispatches stream events to matching hook events", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = []
    const hooks = {
      emit: async (event: string, payload: unknown) => {
        emitted.push({ event, payload })
      },
      checkContinuation: async () => ({ shouldContinue: false }),
    }

    const output: string[] = []
    const loop = new EventLoop(
      hooks as unknown as ConstructorParameters<typeof EventLoop>[0],
      (text) => output.push(text),
    )

    await loop.processStream({
      events: toEvents([
        { type: "thread.started", thread_id: "thread-123" },
        { type: "turn.started" },
        { type: "item.completed", item: { type: "file_change", path: "src/a.ts" } },
        { type: "item.completed", item: { type: "command_execution", command: "bun test" } },
        {
          type: "item.completed",
          item: { type: "agent_message", content: [{ text: "Hello" }, { text: " world" }] },
        },
        { type: "error", message: "boom" },
      ]),
    })

    expect(emitted).toContainEqual({
      event: "thread:started",
      payload: { threadId: "thread-123" },
    })
    expect(emitted).toContainEqual({ event: "turn:started", payload: {} })
    expect(emitted).toContainEqual({
      event: "file_change:completed",
      payload: { item: { type: "file_change", path: "src/a.ts" } },
    })
    expect(emitted).toContainEqual({
      event: "command:completed",
      payload: { item: { type: "command_execution", command: "bun test" } },
    })
    expect(emitted).toContainEqual({ event: "error", payload: { message: "boom" } })
    expect(output).toEqual(["Hello world"])
  })

  it("emits turn completion with parsed usage", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = []
    const hooks = {
      emit: async (event: string, payload: unknown) => {
        emitted.push({ event, payload })
      },
    }

    const loop = new EventLoop(hooks as unknown as ConstructorParameters<typeof EventLoop>[0])

    await loop.processStream({
      events: toEvents([
        {
          type: "turn.completed",
          usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
        },
      ]),
    })

    const turnCompleted = emitted.find((e) => e.event === "turn:completed")
    expect(turnCompleted).toBeDefined()
    expect(turnCompleted?.payload).toEqual({
      usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 },
    })
  })

  it("ignores malformed events and malformed items", async () => {
    const emitted: Array<{ event: string; payload: unknown }> = []
    const hooks = {
      emit: async (event: string, payload: unknown) => {
        emitted.push({ event, payload })
      },
    }
    const loop = new EventLoop(hooks as unknown as ConstructorParameters<typeof EventLoop>[0])

    await loop.processStream({
      events: toEvents([
        null,
        { wrong: "shape" },
        { type: "item.completed", item: { foo: "bar" } },
        { type: "turn.completed", usage: { input_tokens: "bad" } },
      ]),
    })

    expect(emitted).toContainEqual({ event: "turn:completed", payload: { usage: null } })
    expect(emitted.length).toBe(1)
  })
})
