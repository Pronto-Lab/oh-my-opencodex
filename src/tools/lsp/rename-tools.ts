import { formatApplyResult, formatPrepareRenameResult } from "./lsp-formatters"
import { withLspClient } from "./lsp-client-wrapper"
import type { PrepareRenameDefaultBehavior, PrepareRenameResult, WorkspaceEdit } from "./types"
import { applyWorkspaceEdit } from "./workspace-edit"

export async function lspPrepareRename(
  filePath: string,
  line: number,
  character: number
): Promise<string> {
  try {
    const result = await withLspClient(filePath, async (client) => {
      return (await client.prepareRename(filePath, line, character)) as
        | PrepareRenameResult
        | PrepareRenameDefaultBehavior
        | null
    })
    return formatPrepareRenameResult(result)
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}

export async function lspRename(
  filePath: string,
  line: number,
  character: number,
  newName: string
): Promise<string> {
  try {
    const edit = await withLspClient(filePath, async (client) => {
      return (await client.rename(filePath, line, character, newName)) as WorkspaceEdit | null
    })
    return formatApplyResult(applyWorkspaceEdit(edit))
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
