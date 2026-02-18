import { scanCommandDirectory } from "./command-discovery"
import type { CommandTemplate, SlashCommandArgs } from "./types"

interface ParsedCommandInput {
  name: string
  argumentsText: string
}

function parseCommandInput(args: SlashCommandArgs): ParsedCommandInput {
  const commandText = args.command.trim()
  const commandWithoutSlash = commandText.startsWith("/") ? commandText.slice(1) : commandText
  const firstSpace = commandWithoutSlash.indexOf(" ")

  if (firstSpace < 0) {
    return {
      name: commandWithoutSlash,
      argumentsText: args.userMessage?.trim() ?? "",
    }
  }

  const inlineArgs = commandWithoutSlash.slice(firstSpace + 1).trim()
  return {
    name: commandWithoutSlash.slice(0, firstSpace),
    argumentsText: args.userMessage?.trim() ?? inlineArgs,
  }
}

function normalizeName(value: string): string {
  return value.trim().replace(/^\//, "").toLowerCase()
}

function renderCommand(command: CommandTemplate, argumentsText: string): string {
  const withPositionalArgs = command.content.replaceAll("{{args}}", argumentsText)
  const withNamedArgs = withPositionalArgs.replaceAll("$ARGUMENTS", argumentsText)
  return withNamedArgs
}

function formatAvailableCommands(commands: CommandTemplate[]): string {
  if (commands.length === 0) {
    return "(none found in .codex/commands/)"
  }
  return commands.map((command) => `- /${command.name}`).join("\n")
}

function getBuiltinCommands(): CommandTemplate[] {
  return []
}

export async function executeSlashCommand(
  args: SlashCommandArgs,
  workingDir: string
): Promise<string> {
  const parsed = parseCommandInput(args)
  const commandName = normalizeName(parsed.name)
  if (commandName.length === 0) {
    return "command is required"
  }

  const builtinCommands = getBuiltinCommands()
  const userCommands = await scanCommandDirectory(workingDir)
  const allCommands = [...builtinCommands, ...userCommands]

  const command = allCommands.find((candidate) => normalizeName(candidate.name) === commandName)
  if (!command) {
    return `Command "/${parsed.name}" not found.\n\nAvailable commands:\n${formatAvailableCommands(
      allCommands
    )}`
  }

  return renderCommand(command, parsed.argumentsText)
}
