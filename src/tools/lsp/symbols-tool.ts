import { DEFAULT_MAX_SYMBOLS } from "./constants"
import { formatDocumentSymbol, formatSymbolInfo } from "./lsp-formatters"
import { withLspClient } from "./lsp-client-wrapper"
import type { DocumentSymbol, SymbolInfo } from "./types"

export async function lspSymbols(
  filePath: string,
  scope: string,
  query?: string,
  limit?: number
): Promise<string> {
  try {
    const normalizedScope = scope === "workspace" ? "workspace" : "document"
    const max = Math.min(limit ?? DEFAULT_MAX_SYMBOLS, DEFAULT_MAX_SYMBOLS)

    if (normalizedScope === "workspace") {
      if (!query) {
        return "Error: 'query' is required for workspace scope"
      }

      const symbols = await withLspClient(filePath, async (client) => {
        return (await client.workspaceSymbols(query)) as SymbolInfo[] | null
      })
      if (!symbols || symbols.length === 0) {
        return "No symbols found"
      }

      const truncated = symbols.length > max
      const lines = symbols.slice(0, max).map(formatSymbolInfo)
      if (truncated) {
        lines.unshift(`Found ${symbols.length} symbols (showing first ${max}):`)
      }
      return lines.join("\n")
    }

    const symbols = await withLspClient(filePath, async (client) => {
      return (await client.documentSymbols(filePath)) as DocumentSymbol[] | SymbolInfo[] | null
    })
    if (!symbols || symbols.length === 0) {
      return "No symbols found"
    }

    const truncated = symbols.length > max
    const limited = symbols.slice(0, max)
    const lines: string[] = []
    if (truncated) {
      lines.push(`Found ${symbols.length} symbols (showing first ${max}):`)
    }

    if ("range" in limited[0]) {
      lines.push(...(limited as DocumentSymbol[]).map((symbol) => formatDocumentSymbol(symbol)))
    } else {
      lines.push(...(limited as SymbolInfo[]).map(formatSymbolInfo))
    }
    return lines.join("\n")
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
