import { runRgFiles } from "./cli"
import { resolveGrepCliWithAutoInstall } from "./constants"
import { formatGlobResult } from "./result-formatter"

export interface GlobSearchArgs {
  pattern: string
  path?: string
}

export async function globSearch(args: GlobSearchArgs): Promise<string> {
  try {
    const cli = await resolveGrepCliWithAutoInstall()
    const result = await runRgFiles(
      {
        pattern: args.pattern,
        paths: [args.path ?? "."],
      },
      cli
    )
    return formatGlobResult(result)
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
