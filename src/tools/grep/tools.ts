import { runRg } from "./cli"
import { formatGrepResult } from "./result-formatter"

export interface GrepSearchArgs {
  pattern: string
  include?: string
  path?: string
}

export async function grepSearch(args: GrepSearchArgs): Promise<string> {
  try {
    const result = await runRg({
      pattern: args.pattern,
      paths: [args.path ?? "."],
      globs: args.include ? [args.include] : undefined,
      context: 0,
    })
    return formatGrepResult(result)
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
