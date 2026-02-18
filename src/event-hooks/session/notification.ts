import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import { executeCommand } from "../../shared/command-executor"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildNotificationCommand(config: OhMyOpenCodexConfig): string | null {
  if (config.notification?.command) {
    const args = config.notification.args ?? []
    return [config.notification.command, ...args.map(quote)].join(" ")
  }

  if (process.platform === "darwin") {
    return `osascript -e 'display notification "Turn completed" with title "oh-my-opencodex"'`
  }

  if (process.platform === "linux") {
    return "notify-send 'oh-my-opencodex' 'Turn completed'"
  }

  return null
}

export function createNotificationHook(
  config: OhMyOpenCodexConfig,
): HookRegistration<"turn:completed"> {
  return {
    event: "turn:completed",
    priority: 260,
    handler: async () => {
      const command = buildNotificationCommand(config)
      if (command === null) {
        return
      }

      const output = await executeCommand(command)
      log("[notification] notification command executed", {
        command,
        output,
      })
    },
  }
}
