import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

function getOpenCodeConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME
  return xdgConfigHome ? join(xdgConfigHome, "opencode") : join(homedir(), ".config", "opencode")
}

function getDataDir(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support")
  }

  if (process.platform === "win32") {
    return process.env.APPDATA || join(homedir(), "AppData", "Roaming")
  }

  const xdgDataHome = process.env.XDG_DATA_HOME
  return xdgDataHome || join(homedir(), ".local", "share")
}

export function isServerInstalled(command: string[]): boolean {
  if (command.length === 0) {
    return false
  }

  const cmd = command[0]
  if (cmd.includes("/") || cmd.includes("\\")) {
    return existsSync(cmd)
  }

  const isWindows = process.platform === "win32"
  const pathSeparator = isWindows ? ";" : ":"
  const pathEnv = process.env.PATH || (isWindows ? process.env.Path || "" : "")

  let exts = [""]
  if (isWindows) {
    const pathExt = process.env.PATHEXT || ""
    exts = pathExt ? [...new Set(["", ...pathExt.split(";").filter(Boolean)])] : ["", ".exe", ".cmd", ".bat", ".ps1"]
  }

  const paths = pathEnv.split(pathSeparator)
  for (const p of paths) {
    for (const suffix of exts) {
      if (existsSync(join(p, cmd + suffix))) {
        return true
      }
    }
  }

  const cwd = process.cwd()
  const configDir = getOpenCodeConfigDir()
  const dataDir = join(getDataDir(), "opencode")
  const additionalBases = [
    join(cwd, "node_modules", ".bin"),
    join(configDir, "bin"),
    join(configDir, "node_modules", ".bin"),
    join(dataDir, "bin"),
  ]

  for (const base of additionalBases) {
    for (const suffix of exts) {
      if (existsSync(join(base, cmd + suffix))) {
        return true
      }
    }
  }

  return cmd === "bun" || cmd === "node"
}
