import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { EventPayload } from "../../orchestrator/types"

export type TodoItem = {
  content: string
  status: string
}

type TodoListItem = {
  items?: unknown
}

class TodoListWatcher {
  private todoByContent = new Map<string, string>()

  handle(payload: EventPayload["todo_list:completed"]): void {
    const item = payload.item as TodoListItem
    if (!Array.isArray(item.items)) {
      return
    }

    for (const entry of item.items) {
      if (typeof entry !== "object" || entry === null) {
        continue
      }

      const content = (entry as { content?: unknown }).content
      const status = (entry as { status?: unknown }).status
      if (typeof content !== "string" || typeof status !== "string") {
        continue
      }

      this.todoByContent.set(content, status)
    }
  }

  getIncompleteTodos(): TodoItem[] {
    const incomplete: TodoItem[] = []

    for (const [content, status] of this.todoByContent.entries()) {
      if (status === "completed" || status === "cancelled") {
        continue
      }

      incomplete.push({ content, status })
    }

    return incomplete
  }
}

export const todoListWatcher = new TodoListWatcher()

export function createTodoListWatcherHook(_config?: OhMyOpenCodexConfig): {
  event: "todo_list:completed"
  handler: (payload: EventPayload["todo_list:completed"]) => void
  priority: number
} {
  return {
    event: "todo_list:completed",
    priority: 100,
    handler: (payload) => {
      todoListWatcher.handle(payload)
    },
  }
}
