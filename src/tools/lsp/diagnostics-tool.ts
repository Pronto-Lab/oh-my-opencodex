import { DEFAULT_MAX_DIAGNOSTICS } from "./constants"
import { filterDiagnosticsBySeverity, formatDiagnostic } from "./lsp-formatters"
import { withLspClient } from "./lsp-client-wrapper"
import type { Diagnostic } from "./types"

type SeverityFilter = "error" | "warning" | "information" | "hint" | "all"

function normalizeSeverity(severity?: string): SeverityFilter | undefined {
  if (!severity) {
    return undefined
  }

  const value = severity.toLowerCase()
  if (value === "error" || value === "warning" || value === "information" || value === "hint" || value === "all") {
    return value
  }

  return undefined
}

export async function lspDiagnostics(filePath: string, severity?: string): Promise<string> {
  try {
    const result = await withLspClient(filePath, async (client) => {
      return (await client.diagnostics(filePath)) as { items?: Diagnostic[] } | Diagnostic[] | null
    })

    const diagnostics = filterDiagnosticsBySeverity(
      Array.isArray(result) ? result : result?.items ?? [],
      normalizeSeverity(severity)
    )

    if (diagnostics.length === 0) {
      return "No diagnostics found"
    }

    const total = diagnostics.length
    const truncated = total > DEFAULT_MAX_DIAGNOSTICS
    const lines = (truncated ? diagnostics.slice(0, DEFAULT_MAX_DIAGNOSTICS) : diagnostics).map(formatDiagnostic)
    if (truncated) {
      lines.unshift(`Found ${total} diagnostics (showing first ${DEFAULT_MAX_DIAGNOSTICS}):`)
    }
    return lines.join("\n")
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
