import * as fs from "fs"
import * as path from "path"
import { OhMyCodexConfigSchema, type OhMyCodexConfig } from "./schema/oh-my-codex-config"
import { parseJsonc } from "../shared/jsonc-parser"
import { deepMerge } from "../shared/deep-merge"
import { log } from "../shared/logger"

const PROJECT_CONFIG_PATHS = [
  ".codex/oh-my-codex.jsonc",
  ".codex/oh-my-codex.json",
]

const USER_CONFIG_PATHS = [
  path.join(process.env.HOME ?? "", ".config/codex/oh-my-codex.jsonc"),
  path.join(process.env.HOME ?? "", ".config/codex/oh-my-codex.json"),
]

export function getConfigPaths(workingDirectory: string): {
  user: string[]
  project: string[]
} {
  return {
    user: [...USER_CONFIG_PATHS],
    project: PROJECT_CONFIG_PATHS.map((configPath) => path.join(workingDirectory, configPath)),
  }
}

export function loadConfig(workingDirectory: string): OhMyCodexConfig {
  const { user: userConfigPaths, project: projectConfigPaths } = getConfigPaths(workingDirectory)
  const userConfig = loadFirstExisting(userConfigPaths)
  const projectConfig = loadFirstExisting(projectConfigPaths)

  const merged = deepMerge(userConfig ?? {}, projectConfig ?? {}) ?? {}

  const result = OhMyCodexConfigSchema.safeParse(merged)
  if (!result.success) {
    log("Config validation failed", result.error.issues)
    return merged as OhMyCodexConfig
  }

  return result.data
}

function loadFirstExisting(paths: string[]): Record<string, unknown> | undefined {
  for (const configPath of paths) {
    try {
      if (!fs.existsSync(configPath)) {
        continue
      }

      const content = fs.readFileSync(configPath, "utf-8")
      const parsed = parseJsonc<unknown>(content)
      if (isRecord(parsed)) {
        return parsed
      }

      log(`Config root is not an object: ${configPath}`)
      return {}
    } catch (error) {
      log(`Failed to load config from ${configPath}`, error)
    }
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
