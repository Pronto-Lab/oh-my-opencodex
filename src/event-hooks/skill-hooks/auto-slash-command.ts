import type { HookRegistry } from "../hook-registry"
import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"

const SLASH_COMMAND_PATTERN = /^\/([a-z0-9\-]+)(?:\s+(.*))?$/i
const SUPPORTED_COMMANDS = new Set([
  "ralph-loop",
  "stop-continuation",
  "init-deep",
  "publish",
  "handoff",
  "ulw-loop",
  "cancel-ralph",
  "refactor",
  "start-work",
  "remove-deadcode",
  "get-unpublished-changes",
])

interface ParsedCommand {
  command: string
  args: string
}

function parseSlashCommand(text: string): ParsedCommand | null {
  const trimmed = text.trim()

  if (!trimmed.startsWith("/")) {
    return null
  }

  const match = trimmed.match(SLASH_COMMAND_PATTERN)
  if (!match) {
    return null
  }

  const [, command, args = ""] = match
  return {
    command: command.toLowerCase(),
    args: args.trim(),
  }
}

function isSlashCommandDetected(text: string): boolean {
  const parsed = parseSlashCommand(text)
  if (!parsed) {
    return false
  }

  return SUPPORTED_COMMANDS.has(parsed.command)
}

export function createAutoSlashCommandHook(
  config: OhMyOpenCodexConfig,
  registry: HookRegistry,
): void {
  const processedCommands = new Set<string>()

  registry.register(
    "auto-slash-command",
    "turn:started",
    () => {
      void processedCommands
    },
    110,
  )
}
