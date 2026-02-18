import { BLOCKED_COMMAND_MESSAGE, BLOCKED_TMUX_SUBCOMMANDS } from "./constants"
import { getTmuxPath } from "./tmux-path-resolver"
import { executeCommand } from "../../shared/command-executor"

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inQuote = false
  let quoteChar = ""
  let escaped = false

  for (const char of command) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if ((char === "'" || char === '"') && !inQuote) {
      inQuote = true
      quoteChar = char
      continue
    }
    if (char === quoteChar && inQuote) {
      inQuote = false
      quoteChar = ""
      continue
    }
    if (char === " " && !inQuote) {
      if (current) {
        tokens.push(current)
        current = ""
      }
      continue
    }
    current += char
  }

  if (current) {
    tokens.push(current)
  }
  return tokens
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function parseExecutorResult(output: string): { text: string; hasStderr: boolean } {
  const stderrAtEnd = /\n\[stderr:\s*([\s\S]+)\]$/.exec(output)
  if (stderrAtEnd) {
    return { text: stderrAtEnd[1].trim(), hasStderr: true }
  }

  const onlyStderr = /^\[stderr:\s*([\s\S]+)\]$/.exec(output)
  if (onlyStderr) {
    return { text: onlyStderr[1].trim(), hasStderr: true }
  }

  return { text: output.trim(), hasStderr: false }
}

function detectSessionName(parts: string[]): string {
  const sessionIndex = parts.findIndex((part) => part === "-t" || part.startsWith("-t"))
  if (sessionIndex === -1) {
    return "omo-session"
  }
  if (parts[sessionIndex] === "-t") {
    return parts[sessionIndex + 1] ?? "omo-session"
  }
  return parts[sessionIndex].slice(2) || "omo-session"
}

export async function interactiveBash(tmuxCommand: string): Promise<string> {
  const parts = tokenizeCommand(tmuxCommand)
  if (parts.length === 0) {
    return "Error: Empty tmux command"
  }

  const subcommand = parts[0].toLowerCase()
  if (BLOCKED_TMUX_SUBCOMMANDS.includes(subcommand as (typeof BLOCKED_TMUX_SUBCOMMANDS)[number])) {
    return BLOCKED_COMMAND_MESSAGE(parts[0], detectSessionName(parts))
  }

  const tmuxPath = (await getTmuxPath()) ?? "tmux"
  const command = [shellQuote(tmuxPath), ...parts.map(shellQuote)].join(" ")
  const rawResult = await executeCommand(command)
  const parsed = parseExecutorResult(rawResult)

  if (parsed.hasStderr) {
    return `Error: ${parsed.text}`
  }

  return parsed.text || "(no output)"
}
