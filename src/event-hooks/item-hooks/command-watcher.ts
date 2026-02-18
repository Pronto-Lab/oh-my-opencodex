import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import type { EventPayload } from "../../orchestrator/types"
import { log } from "../../shared/logger"

type CommandRecord = {
  command: string
  timestamp: number
}

const DESTRUCTIVE_COMMAND_PATTERNS = [
  /\bgit\s+push\b.*\s--force(?:-with-lease)?\b/i,
  /\brm\s+-rf\b/i,
  /\bdd\s+if=/i,
  /\bmkfs(?:\.|\s)/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
]

class CommandWatcher {
  private destructiveCommands: CommandRecord[] = []

  handle(payload: EventPayload["command:completed"]): void {
    const command = this.extractCommand(payload.item)
    if (!command) {
      return
    }

    log("[item-hook:command-watcher] Command executed", { command })

    if (DESTRUCTIVE_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
      this.destructiveCommands.push({ command, timestamp: Date.now() })
      log("[item-hook:command-watcher] Destructive command detected", { command })
    }
  }

  getDestructiveCommands(): CommandRecord[] {
    return [...this.destructiveCommands]
  }

  private extractCommand(item: EventPayload["command:completed"]["item"]): string {
    const command = (item as { command?: unknown }).command
    if (typeof command === "string") {
      return command
    }

    const text = (item as { text?: unknown }).text
    if (typeof text === "string") {
      return text
    }

    return ""
  }
}

const commandWatcher = new CommandWatcher()

export function getDestructiveCommands(): CommandRecord[] {
  return commandWatcher.getDestructiveCommands()
}

export function createCommandWatcherHook(_config?: OhMyCodexConfig): {
  event: "command:completed"
  handler: (payload: EventPayload["command:completed"]) => void
  priority: number
} {
  return {
    event: "command:completed",
    priority: 100,
    handler: (payload) => {
      commandWatcher.handle(payload)
    },
  }
}
