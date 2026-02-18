import { formatLocation } from "./lsp-formatters"
import { withLspClient } from "./lsp-client-wrapper"
import type { Location, LocationLink } from "./types"

export async function lspGotoDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<string> {
  try {
    const result = await withLspClient(filePath, async (client) => {
      return (await client.definition(filePath, line, character)) as
        | Location
        | Location[]
        | LocationLink[]
        | null
    })

    if (!result) {
      return "No definition found"
    }

    const locations = Array.isArray(result) ? result : [result]
    if (locations.length === 0) {
      return "No definition found"
    }

    return locations.map(formatLocation).join("\n")
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
