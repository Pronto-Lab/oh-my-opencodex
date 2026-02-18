import { SEVERITY_MAP, SYMBOL_KIND_MAP } from "./constants"
import { uriToPath } from "./lsp-client-wrapper"
import type {
  Diagnostic,
  DocumentSymbol,
  Location,
  LocationLink,
  PrepareRenameDefaultBehavior,
  PrepareRenameResult,
  Range,
  SymbolInfo,
  TextEdit,
  WorkspaceEdit,
} from "./types"
import type { ApplyResult } from "./workspace-edit"

export function formatLocation(loc: Location | LocationLink): string {
  if ("targetUri" in loc) {
    return `${uriToPath(loc.targetUri)}:${loc.targetRange.start.line + 1}:${loc.targetRange.start.character}`
  }

  return `${uriToPath(loc.uri)}:${loc.range.start.line + 1}:${loc.range.start.character}`
}

export function formatSymbolKind(kind: number): string {
  return SYMBOL_KIND_MAP[kind] || `Unknown(${kind})`
}

export function formatSeverity(severity: number | undefined): string {
  if (!severity) {
    return "unknown"
  }
  return SEVERITY_MAP[severity] || `unknown(${severity})`
}

export function formatDocumentSymbol(symbol: DocumentSymbol, indent = 0): string {
  const line = `${"  ".repeat(indent)}${symbol.name} (${formatSymbolKind(symbol.kind)}) - line ${symbol.range.start.line + 1}`
  if (!symbol.children || symbol.children.length === 0) {
    return line
  }

  return [line, ...symbol.children.map((child) => formatDocumentSymbol(child, indent + 1))].join("\n")
}

export function formatSymbolInfo(symbol: SymbolInfo): string {
  const container = symbol.containerName ? ` (in ${symbol.containerName})` : ""
  return `${symbol.name} (${formatSymbolKind(symbol.kind)})${container} - ${formatLocation(symbol.location)}`
}

export function formatDiagnostic(diag: Diagnostic): string {
  const source = diag.source ? `[${diag.source}]` : ""
  const code = diag.code ? ` (${diag.code})` : ""
  return `${formatSeverity(diag.severity)}${source}${code} at ${diag.range.start.line + 1}:${diag.range.start.character}: ${diag.message}`
}

export function filterDiagnosticsBySeverity(
  diagnostics: Diagnostic[],
  severityFilter?: "error" | "warning" | "information" | "hint" | "all"
): Diagnostic[] {
  if (!severityFilter || severityFilter === "all") {
    return diagnostics
  }

  const severityByLabel = { error: 1, warning: 2, information: 3, hint: 4 }
  return diagnostics.filter((diag) => diag.severity === severityByLabel[severityFilter])
}

export function formatPrepareRenameResult(
  result: PrepareRenameResult | PrepareRenameDefaultBehavior | Range | null
): string {
  if (!result) {
    return "Cannot rename at this position"
  }
  if ("defaultBehavior" in result) {
    return result.defaultBehavior ? "Rename supported (using default behavior)" : "Cannot rename at this position"
  }
  if ("range" in result) {
    const { start, end } = result.range
    const placeholder = result.placeholder ? ` (current: \"${result.placeholder}\")` : ""
    return `Rename available at ${start.line + 1}:${start.character}-${end.line + 1}:${end.character}${placeholder}`
  }
  return `Rename available at ${result.start.line + 1}:${result.start.character}-${result.end.line + 1}:${result.end.character}`
}

function formatTextEdit(edit: TextEdit): string {
  const preview = edit.newText.length > 50 ? `${edit.newText.slice(0, 50)}...` : edit.newText
  return `  ${edit.range.start.line + 1}:${edit.range.start.character}-${edit.range.end.line + 1}:${edit.range.end.character}: "${preview}"`
}

export function formatWorkspaceEdit(edit: WorkspaceEdit | null): string {
  if (!edit) {
    return "No changes"
  }

  const lines: string[] = []
  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      lines.push(`File: ${uriToPath(uri)}`, ...edits.map(formatTextEdit))
    }
  }
  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      if ("kind" in change) {
        if (change.kind === "create") lines.push(`Create: ${change.uri}`)
        if (change.kind === "rename") lines.push(`Rename: ${change.oldUri} -> ${change.newUri}`)
        if (change.kind === "delete") lines.push(`Delete: ${change.uri}`)
      } else {
        lines.push(`File: ${uriToPath(change.textDocument.uri)}`, ...change.edits.map(formatTextEdit))
      }
    }
  }

  return lines.length > 0 ? lines.join("\n") : "No changes"
}

export function formatApplyResult(result: ApplyResult): string {
  if (result.success) {
    return [
      `Applied ${result.totalEdits} edit(s) to ${result.filesModified.length} file(s):`,
      ...result.filesModified.map((file) => `  - ${file}`),
    ].join("\n")
  }

  const lines = ["Failed to apply some changes:", ...result.errors.map((error) => `  Error: ${error}`)]
  if (result.filesModified.length > 0) {
    lines.push(`Successfully modified: ${result.filesModified.join(", ")}`)
  }
  return lines.join("\n")
}
