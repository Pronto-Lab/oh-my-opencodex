import type { SkillMcpArgs } from "./types"

function selectedOperations(args: SkillMcpArgs): string[] {
  const operations: string[] = []
  if (args.toolName) {
    operations.push(`toolName=${args.toolName}`)
  }
  if (args.resourceName) {
    operations.push(`resourceName=${args.resourceName}`)
  }
  if (args.promptName) {
    operations.push(`promptName=${args.promptName}`)
  }
  return operations
}

export async function skillMcp(args: SkillMcpArgs): Promise<string> {
  if (args.mcpName.trim().length === 0) {
    return "mcpName is required"
  }

  const operations = selectedOperations(args)
  if (operations.length !== 1) {
    return "Specify exactly one of toolName, resourceName, or promptName"
  }

  return [
    "Skill MCP manager not yet initialized",
    `mcpName=${args.mcpName}`,
    operations[0],
  ].join("\n")
}
