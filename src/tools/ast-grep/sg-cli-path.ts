import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { existsSync, statSync } from "node:fs"

import { getCachedBinaryPath } from "./downloader"

function isValidBinary(filePath: string): boolean {
  try {
    return statSync(filePath).size > 10_000
  } catch {
    return false
  }
}

function getPlatformPackageName(): string | null {
  const platformMap: Record<string, string> = {
    "darwin-arm64": "@ast-grep/cli-darwin-arm64",
    "darwin-x64": "@ast-grep/cli-darwin-x64",
    "linux-arm64": "@ast-grep/cli-linux-arm64-gnu",
    "linux-x64": "@ast-grep/cli-linux-x64-gnu",
    "win32-x64": "@ast-grep/cli-win32-x64-msvc",
    "win32-arm64": "@ast-grep/cli-win32-arm64-msvc",
    "win32-ia32": "@ast-grep/cli-win32-ia32-msvc",
  }

  return platformMap[`${process.platform}-${process.arch}`] ?? null
}

export function findSgCliPathSync(): string | null {
  const binaryName = process.platform === "win32" ? "sg.exe" : "sg"

  const cachedPath = getCachedBinaryPath()
  if (cachedPath && isValidBinary(cachedPath)) {
    return cachedPath
  }

  try {
    const require = createRequire(import.meta.url)
    const packagePath = require.resolve("@ast-grep/cli/package.json")
    const sgPath = join(dirname(packagePath), binaryName)
    if (existsSync(sgPath) && isValidBinary(sgPath)) {
      return sgPath
    }
  } catch {
  }

  const platformPackage = getPlatformPackageName()
  if (platformPackage) {
    try {
      const require = createRequire(import.meta.url)
      const packagePath = require.resolve(`${platformPackage}/package.json`)
      const binary = process.platform === "win32" ? "ast-grep.exe" : "ast-grep"
      const binaryPath = join(dirname(packagePath), binary)
      if (existsSync(binaryPath) && isValidBinary(binaryPath)) {
        return binaryPath
      }
    } catch {
    }
  }

  if (process.platform === "darwin") {
    const homebrewPaths = ["/opt/homebrew/bin/sg", "/usr/local/bin/sg"]
    for (const candidate of homebrewPaths) {
      if (existsSync(candidate) && isValidBinary(candidate)) {
        return candidate
      }
    }
  }

  return null
}

let resolvedCliPath: string | null = null

export function getSgCliPath(): string | null {
  if (resolvedCliPath !== null) {
    return resolvedCliPath
  }
  const path = findSgCliPathSync()
  if (path) {
    resolvedCliPath = path
  }
  return path
}

export function setSgCliPath(path: string): void {
  resolvedCliPath = path
}
