import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { load as parseYaml } from "js-yaml"
import { getBuiltinSkills } from "../../features/builtin-skills"
import { SkillMcpManager, type SkillMcpServerConfig } from "../../features/skill-mcp-manager"
import type { SkillMcpArgs, SkillMcpRuntimeContext } from "./types"

type Operation = { type: "tool" | "resource" | "prompt"; name: string }
type SkillMcpServerMatch = { skillName: string; config: SkillMcpServerConfig }

let sharedManager: SkillMcpManager = new SkillMcpManager()

function selectedOperation(args: SkillMcpArgs): Operation | null {
  const options = [
    args.toolName ? { type: "tool" as const, name: args.toolName } : null,
    args.resourceName ? { type: "resource" as const, name: args.resourceName } : null,
    args.promptName ? { type: "prompt" as const, name: args.promptName } : null,
  ].filter((value): value is Operation => value !== null)
  return options.length === 1 ? options[0] : null
}

function parseArguments(value: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === "object") return value
  const normalized = value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1) : value
  const parsed = JSON.parse(normalized)
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("arguments must be a JSON object")
  }
  return parsed as Record<string, unknown>
}

function filterWithGrep(output: string, grep?: string): string {
  if (!grep) return output
  try {
    const regex = new RegExp(grep, "i")
    const lines = output.split("\n").filter((line) => regex.test(line))
    return lines.length > 0 ? lines.join("\n") : `[grep] No lines matched pattern: ${grep}`
  } catch {
    return output
  }
}

function toSkillMcpConfig(input: unknown): SkillMcpServerConfig | null {
  if (!input || typeof input !== "object") return null
  const value = input as { command?: unknown; args?: unknown; env?: unknown }
  if (typeof value.command !== "string" || value.command.length === 0) return null
  const args = Array.isArray(value.args) && value.args.every((item) => typeof item === "string") ? value.args : undefined
  const env =
    value.env &&
    typeof value.env === "object" &&
    Object.values(value.env).every((entry) => typeof entry === "string")
      ? (value.env as Record<string, string>)
      : undefined
  return { command: value.command, args, env }
}

async function collectSkillFiles(rootDirectory: string): Promise<string[]> {
  const discovered: string[] = []
  const walk = async (currentDirectory: string): Promise<void> => {
    const entries = await readdir(currentDirectory, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        discovered.push(fullPath)
      }
    }
  }

  try {
    await walk(rootDirectory)
  } catch {
    return []
  }
  return discovered
}

async function findMcpServer(workingDirectory: string, mcpName: string): Promise<SkillMcpServerMatch | null> {
  for (const skill of getBuiltinSkills()) {
    const config = skill.mcpConfig?.[mcpName]
    if (config) {
      return { skillName: skill.name, config }
    }
  }

  const skillFiles = await collectSkillFiles(path.join(workingDirectory, ".codex", "skills"))
  for (const skillFile of skillFiles) {
    const raw = await readFile(skillFile, "utf8")
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) continue

    const frontmatter = parseYaml(match[1])
    if (!frontmatter || typeof frontmatter !== "object") continue

    const parsed = frontmatter as { name?: unknown; mcp?: Record<string, unknown> }
    const config = parsed.mcp?.[mcpName]
    const normalizedConfig = toSkillMcpConfig(config)
    if (!normalizedConfig) continue

    const skillName = typeof parsed.name === "string" && parsed.name.length > 0
      ? parsed.name
      : path.basename(path.dirname(skillFile))
    return { skillName, config: normalizedConfig }
  }

  return null
}

export function setSkillMcpManager(manager: SkillMcpManager): void {
  sharedManager = manager
}

export async function skillMcp(args: SkillMcpArgs, context: SkillMcpRuntimeContext = {}): Promise<string> {
  const mcpName = args.mcpName.trim()
  if (mcpName.length === 0) {
    return "mcpName is required"
  }

  const operation = selectedOperation(args)
  if (!operation) {
    return "Specify exactly one of toolName, resourceName, or promptName"
  }

  const workingDirectory = context.workingDirectory ?? process.cwd()
  const found = await findMcpServer(workingDirectory, mcpName)
  if (!found) {
    return `MCP server \"${mcpName}\" not found in loaded skill configs`
  }

  const parsedArgs = parseArguments(args.arguments)
  const sessionID = context.sessionID ?? "default"
  const info = { serverName: mcpName, skillName: found.skillName, sessionID }
  const managerContext = { skillName: found.skillName, config: found.config }

  switch (operation.type) {
    case "tool": {
      const result = await sharedManager.callTool(info, managerContext, operation.name, parsedArgs)
      return filterWithGrep(JSON.stringify(result, null, 2), args.grep)
    }
    case "resource": {
      const result = await sharedManager.readResource(info, managerContext, operation.name)
      return filterWithGrep(JSON.stringify(result, null, 2), args.grep)
    }
    case "prompt": {
      const stringArgs = Object.fromEntries(
        Object.entries(parsedArgs).map(([key, value]) => [key, String(value)])
      )
      const result = await sharedManager.getPrompt(info, managerContext, operation.name, stringArgs)
      return filterWithGrep(JSON.stringify(result, null, 2), args.grep)
    }
  }
}
