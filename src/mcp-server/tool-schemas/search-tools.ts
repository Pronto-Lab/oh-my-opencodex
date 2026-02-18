import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod/v4"
import { CLI_LANGUAGES } from "../../tools/ast-grep/language-support"
import type { McpToolContext } from "../types"

export function registerSearchTools(server: McpServer, context: McpToolContext): void {
  if (!context.disabledTools.has("ast_grep_search")) {
    server.registerTool(
      "ast_grep_search",
      {
        title: "AST Grep Search",
        description: "Search code patterns using AST-aware matching.",
        inputSchema: z.object({
          pattern: z.string(),
          lang: z.enum(CLI_LANGUAGES),
          paths: z.array(z.string()).optional(),
          globs: z.array(z.string()).optional(),
          context: z.number().int().min(0).optional(),
        }),
      },
      async (args) => {
        const { astGrepSearch } = await import("../../tools/ast-grep")
        const result = await astGrepSearch(args)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("ast_grep_replace")) {
    server.registerTool(
      "ast_grep_replace",
      {
        title: "AST Grep Replace",
        description: "Replace code patterns using AST-aware rewrites.",
        inputSchema: z.object({
          pattern: z.string(),
          rewrite: z.string(),
          lang: z.enum(CLI_LANGUAGES),
          paths: z.array(z.string()).optional(),
          globs: z.array(z.string()).optional(),
          dryRun: z.boolean().optional(),
        }),
      },
      async (args) => {
        const { astGrepReplace } = await import("../../tools/ast-grep")
        const result = await astGrepReplace(args)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("grep")) {
    server.registerTool(
      "grep",
      {
        title: "Grep Search",
        description: "Search file contents with regular expressions.",
        inputSchema: z.object({
          pattern: z.string(),
          include: z.string().optional(),
          path: z.string().optional(),
        }),
      },
      async (args) => {
        const { grepSearch } = await import("../../tools/grep")
        const result = await grepSearch(args)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("glob")) {
    server.registerTool(
      "glob",
      {
        title: "Glob Search",
        description: "Find files by glob path patterns.",
        inputSchema: z.object({
          pattern: z.string(),
          path: z.string().optional(),
        }),
      },
      async (args) => {
        const { globSearch } = await import("../../tools/glob")
        const result = await globSearch(args)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }
}
