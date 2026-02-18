import type { HookRegistry } from "../event-hooks/hook-registry"
import type { EventPayload, ThreadItem, TokenUsage } from "./types"

type StreamedTurn = { events: AsyncGenerator<unknown> }
type ItemPhase = "started" | "updated" | "completed"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function toUsage(value: unknown): TokenUsage | null {
  if (!isRecord(value)) {
    return null
  }
  const input = value.input_tokens
  const output = value.output_tokens
  const total = value.total_tokens
  if (typeof input !== "number" || typeof output !== "number") {
    return null
  }
  const cached = typeof value.cached_input_tokens === "number" ? value.cached_input_tokens : undefined
  return { input_tokens: input, output_tokens: output, cached_input_tokens: cached }
}

function toThreadItem(value: unknown): ThreadItem | null {
  if (!isRecord(value)) {
    return null
  }
  const type = asString(value.type)
  if (type === null) {
    return null
  }
  switch (type) {
    case "agent_message":
    case "reasoning":
    case "command_execution":
    case "file_change":
    case "mcp_tool_call":
    case "web_search":
    case "todo_list":
    case "error":
      break
    default:
      return null
  }

  const item: ThreadItem = { type }
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key !== "type") {
      item[key] = fieldValue
    }
  }
  return item
}

function getAgentMessageText(item: ThreadItem): string | null {
  if (typeof item.text === "string") {
    return item.text
  }
  const content = item.content
  if (typeof content === "string") {
    return content
  }
  if (!Array.isArray(content)) {
    return null
  }
  const chunks: string[] = []
  for (const chunk of content) {
    if (!isRecord(chunk)) {
      continue
    }
    const text = asString(chunk.text)
    if (text !== null) {
      chunks.push(text)
    }
  }
  return chunks.length > 0 ? chunks.join("") : null
}

export class EventLoop {
  constructor(
    private hooks: HookRegistry,
    private onOutput?: (text: string) => void,
  ) {}

  async processStream(stream: StreamedTurn): Promise<void> {
    for await (const event of stream.events) {
      await this.dispatch(event)
    }
  }

  private async dispatch(event: unknown): Promise<void> {
    if (!isRecord(event) || !("type" in event)) {
      return
    }
    const eventType = asString(event.type)
    if (eventType === null) {
      return
    }
    switch (eventType) {
      case "thread.started":
        await this.hooks.emit("thread:started", {
          threadId: asString(event.thread_id) ?? "",
        })
        return
      case "turn.started":
        await this.hooks.emit("turn:started", {})
        return

      case "turn.completed": {
        const payload: EventPayload["turn:completed"] = {
          usage: toUsage(event.usage),
        }
        await this.hooks.emit("turn:completed", payload)
        return
      }

      case "turn.failed":
        await this.hooks.emit("turn:failed", {
          error: asString(event.error) ?? "turn.failed",
        })
        return
      case "item.started":
        await this.dispatchItem("started", event.item)
        return

      case "item.updated":
        await this.dispatchItem("updated", event.item)
        return

      case "item.completed":
        await this.dispatchItem("completed", event.item)
        return

      case "error":
        await this.hooks.emit("error", {
          message:
            asString(event.message) ?? asString(event.error) ?? "unknown error",
        })
        return
      default:
        return
    }
  }

  private async dispatchItem(phase: ItemPhase, item: unknown): Promise<void> {
    const parsedItem = toThreadItem(item)
    if (parsedItem === null) {
      return
    }
    await this.hooks.emit(`item:${phase}`, { item: parsedItem })
    switch (parsedItem.type) {
      case "file_change":
        await this.hooks.emit("file_change:completed", { item: parsedItem })
        return
      case "todo_list":
        await this.hooks.emit("todo_list:completed", { item: parsedItem })
        return
      case "command_execution":
        await this.hooks.emit("command:completed", { item: parsedItem })
        return
      case "mcp_tool_call":
        await this.hooks.emit("mcp_tool:completed", { item: parsedItem })
        return
      case "agent_message": {
        const text = getAgentMessageText(parsedItem)
        if (text !== null && text.length > 0) {
          this.onOutput?.(text)
        }
        return
      }
      default:
        return
    }
  }

}
