import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import type { EventPayload } from "../../orchestrator/types"

class McpToolWatcher {
  private usageCount = new Map<string, number>()

  handle(payload: EventPayload["mcp_tool:completed"]): void {
    const toolName = this.extractToolName(payload.item)
    if (!toolName) {
      return
    }

    const current = this.usageCount.get(toolName) ?? 0
    this.usageCount.set(toolName, current + 1)
  }

  getToolUsage(): Record<string, number> {
    return Object.fromEntries(this.usageCount.entries())
  }

  private extractToolName(item: EventPayload["mcp_tool:completed"]["item"]): string {
    const toolName = (item as { toolName?: unknown }).toolName
    if (typeof toolName === "string") {
      return toolName
    }

    const name = (item as { name?: unknown }).name
    if (typeof name === "string") {
      return name
    }

    return ""
  }
}

const mcpToolWatcher = new McpToolWatcher()

export function getToolUsage(): Record<string, number> {
  return mcpToolWatcher.getToolUsage()
}

export function createMcpToolWatcherHook(_config?: OhMyCodexConfig): {
  event: "mcp_tool:completed"
  handler: (payload: EventPayload["mcp_tool:completed"]) => void
  priority: number
} {
  return {
    event: "mcp_tool:completed",
    priority: 100,
    handler: (payload) => {
      mcpToolWatcher.handle(payload)
    },
  }
}
