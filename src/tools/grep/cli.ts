import { spawn } from "bun"

import {
  DEFAULT_MAX_COLUMNS,
  DEFAULT_MAX_COUNT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FILESIZE,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
  GREP_SAFETY_FLAGS,
  RG_SAFETY_FLAGS,
  type GrepBackend,
  resolveGrepCli,
} from "./constants"
import type { CountResult, GrepMatch, GrepOptions, GrepResult } from "./types"

function buildArgs(options: GrepOptions, backend: GrepBackend): string[] {
  if (backend === "rg") {
    const args: string[] = [
      ...RG_SAFETY_FLAGS,
      `--max-depth=${Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH)}`,
      `--max-filesize=${options.maxFilesize ?? DEFAULT_MAX_FILESIZE}`,
      `--max-count=${Math.min(options.maxCount ?? DEFAULT_MAX_COUNT, DEFAULT_MAX_COUNT)}`,
      `--max-columns=${Math.min(options.maxColumns ?? DEFAULT_MAX_COLUMNS, DEFAULT_MAX_COLUMNS)}`,
    ]
    if (options.context && options.context > 0) args.push(`-C${Math.min(options.context, 10)}`)
    if (options.caseSensitive) args.push("--case-sensitive")
    if (options.wholeWord) args.push("-w")
    if (options.fixedStrings) args.push("-F")
    if (options.multiline) args.push("-U")
    if (options.hidden) args.push("--hidden")
    if (options.noIgnore) args.push("--no-ignore")
    for (const type of options.fileType ?? []) args.push(`--type=${type}`)
    for (const glob of options.globs ?? []) args.push(`--glob=${glob}`)
    for (const glob of options.excludeGlobs ?? []) args.push(`--glob=!${glob}`)
    return args
  }

  const args: string[] = [...GREP_SAFETY_FLAGS, "-r"]
  if (options.context && options.context > 0) args.push(`-C${Math.min(options.context, 10)}`)
  if (!options.caseSensitive) args.push("-i")
  if (options.wholeWord) args.push("-w")
  if (options.fixedStrings) args.push("-F")
  for (const glob of options.globs ?? []) args.push(`--include=${glob}`)
  for (const glob of options.excludeGlobs ?? []) args.push(`--exclude=${glob}`)
  args.push("--exclude-dir=.git", "--exclude-dir=node_modules")
  return args
}

function parseOutput(output: string): GrepMatch[] {
  const matches: GrepMatch[] = []
  for (const line of output.split("\n")) {
    const match = line.match(/^(.+?):(\d+):(.*)$/)
    if (match) {
      matches.push({ file: match[1], line: Number.parseInt(match[2], 10), text: match[3] })
    }
  }
  return matches
}

export async function runRg(options: GrepOptions): Promise<GrepResult> {
  const cli = resolveGrepCli()
  const args = buildArgs(options, cli.backend)
  const timeout = Math.min(options.timeout ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)

  if (cli.backend === "rg") args.push("--", options.pattern)
  else args.push("-e", options.pattern)
  args.push(...(options.paths?.length ? options.paths : ["."]))

  const proc = spawn([cli.path, ...args], { stdout: "pipe", stderr: "pipe" })
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      proc.kill()
      reject(new Error(`Search timeout after ${timeout}ms`))
    }, timeout)
    proc.exited.then(() => clearTimeout(id))
  })

  try {
    const stdout = await Promise.race([new Response(proc.stdout).text(), timeoutPromise])
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode > 1 && stderr.trim()) {
      return { matches: [], totalMatches: 0, filesSearched: 0, truncated: false, error: stderr.trim() }
    }

    const truncated = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES
    const output = truncated ? stdout.slice(0, DEFAULT_MAX_OUTPUT_BYTES) : stdout
    const matches = parseOutput(output)

    return {
      matches,
      totalMatches: matches.length,
      filesSearched: new Set(matches.map(match => match.file)).size,
      truncated,
    }
  } catch (error) {
    return {
      matches: [],
      totalMatches: 0,
      filesSearched: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function runRgCount(options: Omit<GrepOptions, "context">): Promise<CountResult[]> {
  const cli = resolveGrepCli()
  const args = buildArgs({ ...options, context: 0 }, cli.backend)
  if (cli.backend === "rg") args.push("--count", "--", options.pattern)
  else args.push("-c", "-e", options.pattern)
  args.push(...(options.paths?.length ? options.paths : ["."]))

  const proc = spawn([cli.path, ...args], { stdout: "pipe", stderr: "pipe" })
  const stdout = await new Response(proc.stdout).text()
  return stdout
    .split("\n")
    .map(line => line.match(/^(.+?):(\d+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map(match => ({ file: match[1], count: Number.parseInt(match[2], 10) }))
}
