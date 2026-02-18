import { describe, expect, it } from "bun:test"
import { CodexWrapper } from "./codex-wrapper"

type StreamedTurn = { events: AsyncGenerator<unknown>; finalResponse?: string }

type ThreadMock = {
  id: string | null
  run: () => Promise<{ items: unknown[]; finalResponse: string; usage: unknown }>
  runStreamed: (input: string) => Promise<StreamedTurn>
}

type CodexMock = {
  startThread: (options: Record<string, unknown>) => ThreadMock
  resumeThread: (id: string, options: Record<string, unknown>) => ThreadMock
}

async function* emptyEvents(): AsyncGenerator<unknown> {
  return
}

function createWrapper(config: Record<string, unknown> = {}): CodexWrapper {
  return new CodexWrapper({
    config,
    workingDirectory: "/tmp/workdir",
    agentName: "sisyphus",
    instructions: "agent instructions",
  })
}

describe("CodexWrapper", () => {
  it("starts a session by creating a thread and streaming input", async () => {
    const runInputs: string[] = []
    const thread: ThreadMock = {
      id: "thread-1",
      run: async () => ({ items: [], finalResponse: "ok", usage: {} }),
      runStreamed: async (input: string) => {
        runInputs.push(input)
        return { events: emptyEvents() }
      },
    }
    const startThreadCalls: Record<string, unknown>[] = []

    const codex: CodexMock = {
      startThread: (options) => {
        startThreadCalls.push(options)
        return thread
      },
      resumeThread: () => thread,
    }

    const wrapper = createWrapper({ approval_policy: "never" })
    ;(wrapper as unknown as { codex: CodexMock }).codex = codex

    await wrapper.startSession("hello")
    await wrapper.continueTurn("again")

    expect(startThreadCalls.length).toBe(1)
    expect(runInputs).toEqual(["hello", "again"])
    expect(wrapper.getThreadId()).toBe("thread-1")
  })

  it("resumes existing session with resumeThread and streams input", async () => {
    const resumedInputs: string[] = []
    const thread: ThreadMock = {
      id: "thread-9",
      run: async () => ({ items: [], finalResponse: "ok", usage: {} }),
      runStreamed: async (input: string) => {
        resumedInputs.push(input)
        return { events: emptyEvents() }
      },
    }

    const resumeCalls: Array<{ id: string; options: Record<string, unknown> }> = []
    const codex: CodexMock = {
      startThread: () => thread,
      resumeThread: (id, options) => {
        resumeCalls.push({ id, options })
        return thread
      },
    }

    const wrapper = createWrapper({ web_search_mode: "cached" })
    ;(wrapper as unknown as { codex: CodexMock }).codex = codex

    await wrapper.resumeSession("existing-thread", "resume prompt")

    expect(resumeCalls.length).toBe(1)
    expect(resumeCalls[0]?.id).toBe("existing-thread")
    expect(resumedInputs).toEqual(["resume prompt"])
  })

  it("resolves agent models from config and falls back to defaults", () => {
    const wrapper = createWrapper({
      agents: {
        sisyphus: { model: "gpt-5.1" },
        oracle: { model: "gpt-5.2" },
      },
    })

    expect(wrapper.resolveModel()).toBe("gpt-5.1")
    expect(wrapper.resolveModel("oracle")).toBe("gpt-5.2")
    expect(wrapper.resolveModel("unknown-agent")).toBe("gpt-5.3-codex")
  })

  it("throws when continuing without an active thread", async () => {
    const wrapper = createWrapper()

    await expect(wrapper.continueTurn("no thread yet")).rejects.toThrow("No active thread")
  })
})
