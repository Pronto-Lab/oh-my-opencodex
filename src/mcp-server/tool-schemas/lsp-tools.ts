import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import * as z from "zod/v4"
import type { McpToolContext } from "../types"

export function registerLspTools(server: McpServer, context: McpToolContext): void {
  if (!context.disabledTools.has("lsp_goto_definition")) {
    server.registerTool(
      "lsp_goto_definition",
      {
        title: "LSP Go to Definition",
        description: "Jump to symbol definition. Find WHERE something is defined.",
        inputSchema: z.object({
          filePath: z.string(),
          line: z.number().int().min(1),
          character: z.number().int().min(0),
        }),
      },
      async ({ filePath, line, character }) => {
        const { lspGotoDefinition } = await import("../../tools/lsp")
        const result = await lspGotoDefinition(filePath, line, character)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("lsp_find_references")) {
    server.registerTool(
      "lsp_find_references",
      {
        title: "LSP Find References",
        description: "Find every symbol usage across the workspace.",
        inputSchema: z.object({
          filePath: z.string(),
          line: z.number().int().min(1),
          character: z.number().int().min(0),
          includeDeclaration: z.boolean().optional(),
        }),
      },
      async ({ filePath, line, character, includeDeclaration }) => {
        const { lspFindReferences } = await import("../../tools/lsp")
        const result = await lspFindReferences(filePath, line, character, includeDeclaration)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("lsp_symbols")) {
    server.registerTool(
      "lsp_symbols",
      {
        title: "LSP Symbols",
        description: "List document/workspace symbols for fast navigation.",
        inputSchema: z.object({
          filePath: z.string(),
          scope: z.enum(["document", "workspace"]),
          query: z.string().optional(),
          limit: z.number().int().min(1).optional(),
        }),
      },
      async ({ filePath, scope, query, limit }) => {
        const { lspSymbols } = await import("../../tools/lsp")
        const result = await lspSymbols(filePath, scope, query, limit)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("lsp_diagnostics")) {
    server.registerTool(
      "lsp_diagnostics",
      {
        title: "LSP Diagnostics",
        description: "Read language-server errors and warnings.",
        inputSchema: z.object({
          filePath: z.string(),
          severity: z.enum(["error", "warning", "information", "hint", "all"]).optional(),
        }),
      },
      async ({ filePath, severity }) => {
        const { lspDiagnostics } = await import("../../tools/lsp")
        const result = await lspDiagnostics(filePath, severity)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("lsp_prepare_rename")) {
    server.registerTool(
      "lsp_prepare_rename",
      {
        title: "LSP Prepare Rename",
        description: "Check if a symbol can be renamed safely.",
        inputSchema: z.object({
          filePath: z.string(),
          line: z.number().int().min(1),
          character: z.number().int().min(0),
        }),
      },
      async ({ filePath, line, character }) => {
        const { lspPrepareRename } = await import("../../tools/lsp")
        const result = await lspPrepareRename(filePath, line, character)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }

  if (!context.disabledTools.has("lsp_rename")) {
    server.registerTool(
      "lsp_rename",
      {
        title: "LSP Rename",
        description: "Rename symbol usages across the project.",
        inputSchema: z.object({
          filePath: z.string(),
          line: z.number().int().min(1),
          character: z.number().int().min(0),
          newName: z.string().min(1),
        }),
      },
      async ({ filePath, line, character, newName }) => {
        const { lspRename } = await import("../../tools/lsp")
        const result = await lspRename(filePath, line, character, newName)
        return { content: [{ type: "text", text: result }] }
      },
    )
  }
}
