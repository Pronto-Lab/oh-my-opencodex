import { DEFAULT_MAX_REFERENCES } from "./constants"
import { formatLocation } from "./lsp-formatters"
import { withLspClient } from "./lsp-client-wrapper"
import type { Location } from "./types"

export async function lspFindReferences(
  filePath: string,
  line: number,
  character: number,
  includeDeclaration = true
): Promise<string> {
  try {
    const result = await withLspClient(filePath, async (client) => {
      return (await client.references(filePath, line, character, includeDeclaration)) as Location[] | null
    })

    if (!result || result.length === 0) {
      return "No references found"
    }

    const total = result.length
    const truncated = total > DEFAULT_MAX_REFERENCES
    const lines = (truncated ? result.slice(0, DEFAULT_MAX_REFERENCES) : result).map(formatLocation)
    if (truncated) {
      lines.unshift(`Found ${total} references (showing first ${DEFAULT_MAX_REFERENCES}):`)
    }
    return lines.join("\n")
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
