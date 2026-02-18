import { stat } from "node:fs/promises"

import { spawn } from "bun"

import {
  DEFAULT_LIMIT,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
  RG_FILES_FLAGS,
  resolveGrepCli,
  type GrepBackend,
} from "./constants"
import type { FileMatch, GlobOptions, GlobResult } from "./types"

export interface ResolvedCli {
  path: string
  backend: GrepBackend
}

function buildRgArgs(options: GlobOptions): string[] {
  const args: string[] = [
    ...RG_FILES_FLAGS,
    `--max-depth=${Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH)}`,
  ]
  if (options.hidden !== false) args.push("--hidden")
  if (options.follow !== false) args.push("--follow")
  if (options.noIgnore) args.push("--no-ignore")
  args.push(`--glob=${options.pattern}`)
  return args
}

function buildFindArgs(options: GlobOptions): string[] {
  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH)
  const args = [".", "-maxdepth", String(maxDepth), "-type", "f", "-name", options.pattern]
  if (options.follow !== false) args.unshift("-L")
  if (options.hidden === false) args.push("-not", "-path", "*/.*")
  return args
}

function buildPowerShellCommand(options: GlobOptions): string[] {
  const maxDepth = Math.min(options.maxDepth ?? DEFAULT_MAX_DEPTH, DEFAULT_MAX_DEPTH)
  const searchPath = options.paths?.[0] ?? "."
  const escapedPath = searchPath.replace(/'/g, "''")
  const escapedPattern = options.pattern.replace(/'/g, "''")

  let command = `Get-ChildItem -Path '${escapedPath}' -File -Recurse -Depth ${maxDepth - 1} -Filter '${escapedPattern}'`
  if (options.hidden !== false) command += " -Force"
  command += " -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName"
  return ["powershell", "-NoProfile", "-Command", command]
}

async function getFileMtime(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).mtime.getTime()
  } catch {
    return 0
  }
}

export async function runRgFiles(options: GlobOptions, resolvedCli?: ResolvedCli): Promise<GlobResult> {
  const cli = resolvedCli ?? resolveGrepCli()
  const timeout = Math.min(options.timeout ?? DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT)

  const isRg = cli.backend === "rg"
  const isWindows = process.platform === "win32"
  const paths = options.paths?.length ? options.paths : ["."]

  const command = isRg
    ? [cli.path, ...buildRgArgs(options), ...paths]
    : isWindows
      ? buildPowerShellCommand(options)
      : [cli.path, ...buildFindArgs(options)]
  const cwd = !isRg && !isWindows ? (paths[0] ?? ".") : undefined

  const proc = spawn(command, { stdout: "pipe", stderr: "pipe", cwd })
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      proc.kill()
      reject(new Error(`Glob search timeout after ${timeout}ms`))
    }, timeout)
    proc.exited.then(() => clearTimeout(id))
  })

  try {
    const stdout = await Promise.race([new Response(proc.stdout).text(), timeoutPromise])
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode > 1 && stderr.trim()) {
      return { files: [], totalFiles: 0, truncated: false, error: stderr.trim() }
    }

    const outputTruncated = stdout.length >= DEFAULT_MAX_OUTPUT_BYTES
    const output = (outputTruncated ? stdout.slice(0, DEFAULT_MAX_OUTPUT_BYTES) : stdout).trim()
    const lines = output ? output.split("\n") : []

    const files: FileMatch[] = []
    let truncated = false

    for (const line of lines) {
      if (files.length >= limit) {
        truncated = true
        break
      }
      const filePath = isRg ? line : isWindows ? line.trim() : `${cwd}/${line}`
      files.push({ path: filePath, mtime: await getFileMtime(filePath) })
    }

    files.sort((a, b) => b.mtime - a.mtime)
    return { files, totalFiles: files.length, truncated: truncated || outputTruncated }
  } catch (error) {
    return {
      files: [],
      totalFiles: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
