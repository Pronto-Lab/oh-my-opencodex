import { chmodSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

import { executeCommand } from "../../shared/command-executor"
import { log } from "../../shared/logger"

const REPO = "ast-grep/ast-grep"
const DEFAULT_VERSION = "0.40.0"

const PLATFORM_MAP: Record<string, { arch: string; os: string } | undefined> = {
  "darwin-arm64": { arch: "aarch64", os: "apple-darwin" },
  "darwin-x64": { arch: "x86_64", os: "apple-darwin" },
  "linux-arm64": { arch: "aarch64", os: "unknown-linux-gnu" },
  "linux-x64": { arch: "x86_64", os: "unknown-linux-gnu" },
  "win32-x64": { arch: "x86_64", os: "pc-windows-msvc" },
  "win32-arm64": { arch: "aarch64", os: "pc-windows-msvc" },
  "win32-ia32": { arch: "i686", os: "pc-windows-msvc" },
}

function getAstGrepVersion(): string {
  try {
    const require = createRequire(import.meta.url)
    return require("@ast-grep/cli/package.json").version as string
  } catch {
    return DEFAULT_VERSION
  }
}

export function getCacheDir(): string {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || join(process.env.USERPROFILE ?? ".", "AppData", "Local")
    return join(base, "oh-my-opencodex", "bin")
  }
  const base = process.env.XDG_CACHE_HOME || join(process.env.HOME ?? ".", ".cache")
  return join(base, "oh-my-opencodex", "bin")
}

export function getBinaryName(): string {
  return process.platform === "win32" ? "sg.exe" : "sg"
}

export function getCachedBinaryPath(): string | null {
  const path = join(getCacheDir(), getBinaryName())
  if (!existsSync(path)) return null
  try {
    return statSync(path).size > 10_000 ? path : null
  } catch {
    return null
  }
}

async function extractZipArchive(archivePath: string, cacheDir: string): Promise<void> {
  if (process.platform === "win32") {
    await executeCommand(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${cacheDir}' -Force"`)
    return
  }
  await executeCommand(`unzip -o "${archivePath}" -d "${cacheDir}"`)
}

export async function downloadAstGrep(version: string = DEFAULT_VERSION): Promise<string | null> {
  const platformInfo = PLATFORM_MAP[`${process.platform}-${process.arch}`]
  if (!platformInfo) return null

  const cacheDir = getCacheDir()
  const binaryPath = join(cacheDir, getBinaryName())
  if (existsSync(binaryPath)) return binaryPath

  const assetName = `app-${platformInfo.arch}-${platformInfo.os}.zip`
  const url = `https://github.com/${REPO}/releases/download/${version}/${assetName}`
  const archivePath = join(cacheDir, assetName)

  try {
    mkdirSync(cacheDir, { recursive: true })
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()))

    await extractZipArchive(archivePath, cacheDir)
    rmSync(archivePath, { force: true })

    if (process.platform !== "win32" && existsSync(binaryPath)) {
      chmodSync(binaryPath, 0o755)
    }
    return existsSync(binaryPath) ? binaryPath : null
  } catch (error) {
    log("[ast-grep] download failed", { error: error instanceof Error ? error.message : String(error) })
    try {
      rmSync(archivePath, { force: true })
    } catch {
    }
    return null
  }
}

export async function ensureAstGrepBinary(): Promise<string | null> {
  const cachedPath = getCachedBinaryPath()
  if (cachedPath) return cachedPath
  return downloadAstGrep(getAstGrepVersion())
}
