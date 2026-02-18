import { dirname, join } from "node:path"
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

import { downloadAndInstallRipgrep, getInstalledRipgrepPath } from "./downloader"

export type GrepBackend = "rg" | "grep"

interface ResolvedCli {
  path: string
  backend: GrepBackend
}

let cachedCli: ResolvedCli | null = null
let autoInstallAttempted = false

function findExecutable(name: string): string | null {
  const cmd = process.platform === "win32" ? "where" : "which"
  try {
    const result = spawnSync(cmd, [name], { encoding: "utf-8", timeout: 5000 })
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim().split("\n")[0]
    }
  } catch {
  }
  return null
}

function getCodexBundledRg(): string | null {
  const execDir = dirname(process.execPath)
  const rgName = process.platform === "win32" ? "rg.exe" : "rg"
  const candidates = [
    join(execDir, rgName),
    join(execDir, "bin", rgName),
    join(execDir, "..", "bin", rgName),
    join(execDir, "..", "libexec", rgName),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export function resolveGrepCli(): ResolvedCli {
  if (cachedCli) return cachedCli

  const bundledRg = getCodexBundledRg()
  if (bundledRg) return (cachedCli = { path: bundledRg, backend: "rg" })

  const systemRg = findExecutable("rg")
  if (systemRg) return (cachedCli = { path: systemRg, backend: "rg" })

  const installedRg = getInstalledRipgrepPath()
  if (installedRg) return (cachedCli = { path: installedRg, backend: "rg" })

  const grep = findExecutable("grep")
  if (grep) return (cachedCli = { path: grep, backend: "grep" })

  return (cachedCli = { path: "rg", backend: "rg" })
}

export async function resolveGrepCliWithAutoInstall(): Promise<ResolvedCli> {
  const current = resolveGrepCli()
  if (current.backend === "rg" || autoInstallAttempted) {
    return current
  }

  autoInstallAttempted = true
  try {
    cachedCli = { path: await downloadAndInstallRipgrep(), backend: "rg" }
  } catch {
  }
  return cachedCli ?? current
}

export const DEFAULT_MAX_DEPTH = 20
export const DEFAULT_MAX_FILESIZE = "10M"
export const DEFAULT_MAX_COUNT = 500
export const DEFAULT_MAX_COLUMNS = 1000
export const DEFAULT_TIMEOUT_MS = 300_000
export const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024

export const RG_SAFETY_FLAGS = [
  "--no-follow",
  "--color=never",
  "--no-heading",
  "--line-number",
  "--with-filename",
] as const

export const GREP_SAFETY_FLAGS = ["-n", "-H", "--color=never"] as const
