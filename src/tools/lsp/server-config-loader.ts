import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { parseJsonc, detectConfigFile } from "../../shared/jsonc-parser"
import { BUILTIN_SERVERS } from "./constants"
import type { ResolvedServer } from "./types"

interface LspEntry {
  disabled?: boolean
  command?: string[]
  extensions?: string[]
  priority?: number
  env?: Record<string, string>
  initialization?: Record<string, unknown>
}

interface ConfigJson {
  lsp?: Record<string, LspEntry>
}

type ConfigSource = "project" | "user" | "codex"

interface ServerWithSource extends ResolvedServer {
  source: ConfigSource
}

function getCodexConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME
  return xdgConfigHome ? join(xdgConfigHome, "codex") : join(homedir(), ".config", "codex")
}

export function loadJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null
  }

  try {
    return parseJsonc(readFileSync(path, "utf-8")) as T
  } catch {
    return null
  }
}

export function getConfigPaths(): { project: string; user: string; codex: string } {
  const cwd = process.cwd()
  const configDir = getCodexConfigDir()

  return {
    project: detectConfigFile(join(cwd, ".codex", "oh-my-codex")).path,
    user: detectConfigFile(join(configDir, "oh-my-codex")).path,
    codex: detectConfigFile(join(configDir, "codex")).path,
  }
}

export function loadAllConfigs(): Map<ConfigSource, ConfigJson> {
  const paths = getConfigPaths()
  const configs = new Map<ConfigSource, ConfigJson>()

  const project = loadJsonFile<ConfigJson>(paths.project)
  if (project) {
    configs.set("project", project)
  }

  const user = loadJsonFile<ConfigJson>(paths.user)
  if (user) {
    configs.set("user", user)
  }

  const codex = loadJsonFile<ConfigJson>(paths.codex)
  if (codex) {
    configs.set("codex", codex)
  }

  return configs
}

export function getMergedServers(): ServerWithSource[] {
  const configs = loadAllConfigs()
  const servers: ServerWithSource[] = []
  const disabled = new Set<string>()
  const seen = new Set<string>()
  const sources: ConfigSource[] = ["project", "user", "codex"]

  for (const source of sources) {
    const config = configs.get(source)
    if (!config?.lsp) {
      continue
    }

    for (const [id, entry] of Object.entries(config.lsp)) {
      if (entry.disabled) {
        disabled.add(id)
        continue
      }
      if (seen.has(id) || !entry.command || !entry.extensions) {
        continue
      }

      servers.push({
        id,
        command: entry.command,
        extensions: entry.extensions,
        priority: entry.priority ?? 0,
        env: entry.env,
        initialization: entry.initialization,
        source,
      })
      seen.add(id)
    }
  }

  for (const [id, config] of Object.entries(BUILTIN_SERVERS)) {
    if (disabled.has(id) || seen.has(id)) {
      continue
    }

    servers.push({
      id,
      command: config.command,
      extensions: config.extensions,
      priority: -100,
      source: "codex",
    })
  }

  return servers.sort((a, b) => {
    if (a.source !== b.source) {
      const order: Record<ConfigSource, number> = { project: 0, user: 1, codex: 2 }
      return order[a.source] - order[b.source]
    }

    return b.priority - a.priority
  })
}
