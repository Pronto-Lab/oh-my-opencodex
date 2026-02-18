import { runSg } from "./cli"
import { formatReplaceResult, formatSearchResult } from "./result-formatter"
import type { CliLanguage } from "./types"

export interface AstGrepSearchArgs {
  pattern: string
  lang: CliLanguage
  paths?: string[]
  globs?: string[]
  context?: number
}

export interface AstGrepReplaceArgs {
  pattern: string
  rewrite: string
  lang: CliLanguage
  paths?: string[]
  globs?: string[]
  dryRun?: boolean
}

function getEmptyResultHint(pattern: string, lang: CliLanguage): string | null {
  const src = pattern.trim()

  if (lang === "python" && src.endsWith(":")) {
    if (src.startsWith("class ") || src.startsWith("def ") || src.startsWith("async def ")) {
      return `Hint: Remove trailing colon. Try: "${src.slice(0, -1)}"`
    }
  }

  if (["javascript", "typescript", "tsx"].includes(lang)) {
    if (/^(export\s+)?(async\s+)?function\s+\$[A-Z_]+\s*$/i.test(src)) {
      return "Hint: Function patterns need params and body. Try \"function $NAME($$$) { $$$ }\""
    }
  }

  return null
}

export async function astGrepSearch(args: AstGrepSearchArgs): Promise<string> {
  try {
    const result = await runSg({
      pattern: args.pattern,
      lang: args.lang,
      paths: args.paths ?? ["."],
      globs: args.globs,
      context: args.context,
    })

    let output = formatSearchResult(result)
    if (result.matches.length === 0 && !result.error) {
      const hint = getEmptyResultHint(args.pattern, args.lang)
      if (hint) output += `\n\n${hint}`
    }
    return output
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}

export async function astGrepReplace(args: AstGrepReplaceArgs): Promise<string> {
  try {
    const result = await runSg({
      pattern: args.pattern,
      rewrite: args.rewrite,
      lang: args.lang,
      paths: args.paths ?? ["."],
      globs: args.globs,
      updateAll: args.dryRun === false,
    })

    return formatReplaceResult(result, args.dryRun !== false)
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
