import { readFileSync, writeFileSync, unlinkSync } from "node:fs"

import { uriToPath } from "./lsp-client-wrapper"
import type { TextEdit, WorkspaceEdit } from "./types"

export interface ApplyResult {
  success: boolean
  filesModified: string[]
  totalEdits: number
  errors: string[]
}

function applyTextEditsToFile(
  filePath: string,
  edits: TextEdit[]
): { success: boolean; editCount: number; error?: string } {
  try {
    const lines = readFileSync(filePath, "utf-8").split("\n")
    const sortedEdits = [...edits].sort((a, b) => {
      if (b.range.start.line !== a.range.start.line) {
        return b.range.start.line - a.range.start.line
      }
      return b.range.start.character - a.range.start.character
    })

    for (const edit of sortedEdits) {
      const { start, end } = edit.range
      if (start.line === end.line) {
        const line = lines[start.line] || ""
        lines[start.line] = line.slice(0, start.character) + edit.newText + line.slice(end.character)
        continue
      }

      const firstLine = lines[start.line] || ""
      const lastLine = lines[end.line] || ""
      const merged = firstLine.slice(0, start.character) + edit.newText + lastLine.slice(end.character)
      lines.splice(start.line, end.line - start.line + 1, ...merged.split("\n"))
    }

    writeFileSync(filePath, lines.join("\n"), "utf-8")
    return { success: true, editCount: edits.length }
  } catch (error) {
    return {
      success: false,
      editCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export function applyWorkspaceEdit(edit: WorkspaceEdit | null): ApplyResult {
  if (!edit) {
    return { success: false, filesModified: [], totalEdits: 0, errors: ["No edit provided"] }
  }

  const result: ApplyResult = { success: true, filesModified: [], totalEdits: 0, errors: [] }

  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const filePath = uriToPath(uri)
      const fileResult = applyTextEditsToFile(filePath, edits)
      if (fileResult.success) {
        result.filesModified.push(filePath)
        result.totalEdits += fileResult.editCount
      } else {
        result.success = false
        result.errors.push(`${filePath}: ${fileResult.error}`)
      }
    }
  }

  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      if ("kind" in change) {
        try {
          if (change.kind === "create") {
            writeFileSync(uriToPath(change.uri), "", "utf-8")
          } else if (change.kind === "rename") {
            const oldPath = uriToPath(change.oldUri)
            const newPath = uriToPath(change.newUri)
            writeFileSync(newPath, readFileSync(oldPath, "utf-8"), "utf-8")
            unlinkSync(oldPath)
          } else if (change.kind === "delete") {
            unlinkSync(uriToPath(change.uri))
          }
        } catch (error) {
          result.success = false
          result.errors.push(`${change.kind} operation failed: ${error instanceof Error ? error.message : String(error)}`)
        }
        continue
      }

      const filePath = uriToPath(change.textDocument.uri)
      const fileResult = applyTextEditsToFile(filePath, change.edits)
      if (fileResult.success) {
        result.filesModified.push(filePath)
        result.totalEdits += fileResult.editCount
      } else {
        result.success = false
        result.errors.push(`${filePath}: ${fileResult.error}`)
      }
    }
  }

  return result
}
