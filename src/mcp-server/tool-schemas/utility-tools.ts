import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod/v4"
import type { McpToolContext } from "../types"

export function registerUtilityTools(server: McpServer, context: McpToolContext): void {
  if (!context.disabledTools.has("look_at")) {
    server.registerTool(
      "look_at",
      {
        title: "Look At",
        description: "Analyze media files and extract useful information.",
        inputSchema: z.object({
          file_path: z.string().optional(),
          filePath: z.string().optional(),
          path: z.string().optional(),
          image_data: z.string().optional(),
          imageData: z.string().optional(),
          goal: z.string(),
        }),
      },
      async ({ file_path, filePath, path, image_data, imageData, goal }) => {
        const { lookAt } = await import("../../tools/look-at")
        const result = await lookAt({
          filePath: file_path ?? filePath ?? path,
          imageData: image_data ?? imageData,
          goal,
        })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("interactive_bash")) {
    server.registerTool(
      "interactive_bash",
      {
        title: "Interactive Bash",
        description: "Run tmux subcommands for interactive terminal workflows.",
        inputSchema: z.object({
          tmux_command: z.string(),
        }),
      },
      async ({ tmux_command }) => {
        const { interactiveBash } = await import("../../tools/interactive-bash")
        const result = await interactiveBash(tmux_command)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("skill")) {
    server.registerTool(
      "skill",
      {
        title: "Skill",
        description: "Load a skill document by name.",
        inputSchema: z.object({
          name: z.string(),
        }),
      },
      async ({ name }) => {
        const { loadSkill } = await import("../../tools/skill")
        const result = await loadSkill(name, context.workingDirectory)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("skill_mcp")) {
    server.registerTool(
      "skill_mcp",
      {
        title: "Skill MCP",
        description: "Invoke MCP operations embedded in skills.",
        inputSchema: z.object({
          mcp_name: z.string(),
          tool_name: z.string().optional(),
          resource_name: z.string().optional(),
          prompt_name: z.string().optional(),
          arguments: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
          grep: z.string().optional(),
        }),
      },
      async ({ mcp_name, tool_name, resource_name, prompt_name, arguments: toolArguments }) => {
        const { skillMcp } = await import("../../tools/skill-mcp")
        const result = await skillMcp({
          mcpName: mcp_name,
          toolName: tool_name,
          resourceName: resource_name,
          promptName: prompt_name,
          arguments: toolArguments,
        })
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("slashcommand")) {
    server.registerTool(
      "slashcommand",
      {
        title: "Slash Command",
        description: "Load and execute slash command templates.",
        inputSchema: z.object({
          command: z.string(),
          user_message: z.string().optional(),
        }),
      },
      async ({ command, user_message }) => {
        const { executeSlashCommand } = await import("../../tools/slashcommand")
        const result = await executeSlashCommand(
          {
            command,
            userMessage: user_message,
          },
          context.workingDirectory,
        )
        return { content: [{ type: "text", text: result }] }
      },
    )
  }
}
