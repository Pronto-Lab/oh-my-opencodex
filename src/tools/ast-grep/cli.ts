import { spawn } from "bun"
import { existsSync } from "node:fs"

import { DEFAULT_TIMEOUT_MS, getSgCliPath } from "./constants"
import { getAstGrepPath, ensureCliAvailable, isCliAvailable, startBackgroundInit } from "./cli-binary-path-resolution"
import { ensureAstGrepBinary } from "./downloader"
import { collectProcessOutputWithTimeout } from "./process-output-timeout"
import { createSgResultFromStdout } from "./sg-compact-json-output"
import type { CliLanguage, SgResult } from "./types"

export { ensureCliAvailable, isCliAvailable, startBackgroundInit }

export interface RunOptions {
  pattern: string
  lang: CliLanguage
  paths?: string[]
  globs?: string[]
  rewrite?: string
  context?: number
  updateAll?: boolean
}

function buildRunArgs(options: RunOptions): string[] {
  const args = ["run", "-p", options.pattern, "--lang", options.lang, "--json=compact"]
  if (options.rewrite) args.push("-r", options.rewrite)
  if (options.context && options.context > 0) args.push("-C", String(options.context))
  if (options.globs) {
    for (const glob of options.globs) args.push("--globs", glob)
  }
  const paths = options.paths && options.paths.length > 0 ? options.paths : ["."]
  args.push(...paths)
  return args
}

function missingBinaryResult(): SgResult {
  return {
    matches: [],
    totalMatches: 0,
    truncated: false,
    error: "ast-grep (sg) binary not found. Install @ast-grep/cli or ast-grep.",
  }
}

export async function runSg(options: RunOptions): Promise<SgResult> {
  const shouldSeparateWritePass = Boolean(options.rewrite && options.updateAll)
  const args = buildRunArgs(options)

  let cliPath = getSgCliPath()
  if (!cliPath || !existsSync(cliPath)) {
    cliPath = await getAstGrepPath()
    if (!cliPath) return missingBinaryResult()
  }

  try {
    const proc = spawn([cliPath, ...args], { stdout: "pipe", stderr: "pipe" })
    const output = await collectProcessOutputWithTimeout(proc, DEFAULT_TIMEOUT_MS)

    if (output.exitCode !== 0 && output.stdout.trim() === "") {
      const error = output.stderr.includes("No files found") ? undefined : output.stderr.trim() || undefined
      return { matches: [], totalMatches: 0, truncated: false, error }
    }

    const jsonResult = createSgResultFromStdout(output.stdout)
    if (shouldSeparateWritePass && jsonResult.matches.length > 0) {
      const writeArgs = args.filter(arg => arg !== "--json=compact")
      writeArgs.push("--update-all")
      const writeProc = spawn([cliPath, ...writeArgs], { stdout: "pipe", stderr: "pipe" })
      const writeOutput = await collectProcessOutputWithTimeout(writeProc, DEFAULT_TIMEOUT_MS)
      if (writeOutput.exitCode !== 0) {
        return { ...jsonResult, error: writeOutput.stderr.trim() || "Replace failed" }
      }
    }

    return jsonResult
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
      const downloadedPath = await ensureAstGrepBinary()
      if (downloadedPath) return runSg(options)
      return missingBinaryResult()
    }
    if (errorMessage.includes("timeout")) {
      return {
        matches: [],
        totalMatches: 0,
        truncated: true,
        truncatedReason: "timeout",
        error: errorMessage,
      }
    }
    return { matches: [], totalMatches: 0, truncated: false, error: errorMessage }
  }
}
