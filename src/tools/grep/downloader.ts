import { chmodSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { executeCommand } from "../../shared/command-executor"
import { log } from "../../shared/logger"

const RG_VERSION = "14.1.1"

const PLATFORM_CONFIG: Record<string, { platform: string; extension: "tar.gz" | "zip" } | undefined> = {
  "arm64-darwin": { platform: "aarch64-apple-darwin", extension: "tar.gz" },
  "arm64-linux": { platform: "aarch64-unknown-linux-gnu", extension: "tar.gz" },
  "x64-darwin": { platform: "x86_64-apple-darwin", extension: "tar.gz" },
  "x64-linux": { platform: "x86_64-unknown-linux-musl", extension: "tar.gz" },
  "x64-win32": { platform: "x86_64-pc-windows-msvc", extension: "zip" },
}

function getInstallDir(): string {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || process.env.APPDATA || join(process.env.USERPROFILE ?? ".", "AppData", "Local")
    return join(base, "oh-my-codex", "bin")
  }
  const base = process.env.XDG_CACHE_HOME || join(process.env.HOME ?? ".", ".cache")
  return join(base, "oh-my-codex", "bin")
}

function getRgPath(): string {
  return join(getInstallDir(), process.platform === "win32" ? "rg.exe" : "rg")
}

function findFileRecursive(dir: string, filename: string): string | null {
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name === filename) {
      return join((entry.parentPath as string | undefined) ?? dir, entry.name)
    }
  }
  return null
}

async function extractArchive(archivePath: string, installDir: string, extension: "tar.gz" | "zip"): Promise<void> {
  if (extension === "tar.gz") {
    await executeCommand(`tar -xzf "${archivePath}" --strip-components=1 -C "${installDir}"`)
    return
  }

  if (process.platform === "win32") {
    await executeCommand(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${installDir}' -Force"`)
  } else {
    await executeCommand(`unzip -o "${archivePath}" -d "${installDir}"`)
  }

  const binaryName = process.platform === "win32" ? "rg.exe" : "rg"
  const foundPath = findFileRecursive(installDir, binaryName)
  const targetPath = join(installDir, binaryName)
  if (foundPath && foundPath !== targetPath) {
    renameSync(foundPath, targetPath)
  }
}

export async function downloadAndInstallRipgrep(): Promise<string> {
  const config = PLATFORM_CONFIG[`${process.arch}-${process.platform}`]
  if (!config) {
    throw new Error(`Unsupported platform: ${process.arch}-${process.platform}`)
  }

  const installDir = getInstallDir()
  const rgPath = getRgPath()
  if (existsSync(rgPath)) return rgPath

  mkdirSync(installDir, { recursive: true })
  const filename = `ripgrep-${RG_VERSION}-${config.platform}.${config.extension}`
  const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}/${filename}`
  const archivePath = join(installDir, filename)

  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()))

    await extractArchive(archivePath, installDir, config.extension)
    if (process.platform !== "win32" && existsSync(rgPath)) {
      chmodSync(rgPath, 0o755)
    }

    if (!existsSync(rgPath)) {
      throw new Error("ripgrep binary not found after extraction")
    }
    return rgPath
  } catch (error) {
    log("[grep] ripgrep download failed", { error: error instanceof Error ? error.message : String(error) })
    throw error
  } finally {
    rmSync(archivePath, { force: true })
  }
}

export function getInstalledRipgrepPath(): string | null {
  const path = getRgPath()
  return existsSync(path) ? path : null
}
