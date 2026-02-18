import { createRequire } from "node:module"
import { existsSync } from "node:fs"

import { CLI_LANGUAGES, NAPI_LANGUAGES } from "./language-support"
import { getSgCliPath } from "./sg-cli-path"

export interface EnvironmentCheckResult {
  cli: {
    available: boolean
    path: string
    error?: string
  }
  napi: {
    available: boolean
    error?: string
  }
}

export function checkEnvironment(): EnvironmentCheckResult {
  const cliPath = getSgCliPath()
  const result: EnvironmentCheckResult = {
    cli: { available: false, path: cliPath ?? "not found" },
    napi: { available: false },
  }

  if (cliPath && existsSync(cliPath)) {
    result.cli.available = true
  } else {
    result.cli.error = cliPath ? `Binary not found: ${cliPath}` : "ast-grep binary not found"
  }

  try {
    const require = createRequire(import.meta.url)
    require("@ast-grep/napi")
    result.napi.available = true
  } catch (error) {
    result.napi.error = `@ast-grep/napi not installed: ${error instanceof Error ? error.message : String(error)}`
  }

  return result
}

export function formatEnvironmentCheck(result: EnvironmentCheckResult): string {
  const lines: string[] = ["ast-grep Environment Status:", ""]

  if (result.cli.available) {
    lines.push(`[OK] CLI: Available (${result.cli.path})`)
  } else {
    lines.push("[X] CLI: Not available")
    if (result.cli.error) lines.push(`  Error: ${result.cli.error}`)
    lines.push("  Install: bun add -D @ast-grep/cli")
  }

  if (result.napi.available) {
    lines.push("[OK] NAPI: Available")
  } else {
    lines.push("[X] NAPI: Not available")
    if (result.napi.error) lines.push(`  Error: ${result.napi.error}`)
    lines.push("  Install: bun add -D @ast-grep/napi")
  }

  lines.push("")
  lines.push(`CLI supports ${CLI_LANGUAGES.length} languages`)
  lines.push(`NAPI supports ${NAPI_LANGUAGES.length} languages: ${NAPI_LANGUAGES.join(", ")}`)
  return lines.join("\n")
}
