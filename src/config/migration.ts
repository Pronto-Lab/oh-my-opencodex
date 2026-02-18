import * as fs from "fs"
import * as path from "path"
import { OhMyOpenCodexConfigSchema, type OhMyOpenCodexConfig } from "./schema/oh-my-opencodex-config"
import { parseJsonc } from "../shared/jsonc-parser"
import { log } from "../shared/logger"

const LEGACY_CONFIG_PATHS = [
  ".opencode/oh-my-opencodex.jsonc",
  ".opencode/oh-my-opencodex.json",
]

const LEGACY_USER_CONFIG_PATHS = [
  path.join(process.env.HOME ?? "", ".config/opencode/oh-my-opencodex.jsonc"),
  path.join(process.env.HOME ?? "", ".config/opencode/oh-my-opencodex.json"),
]

const OPENAI_MODEL_MAP: Record<string, string> = {
  "claude-sonnet-4-20250514": "gpt-5.3-codex",
  "claude-opus-4-20250514": "gpt-5.3-codex",
  "gemini-2.5-pro": "gpt-5.1",
  "grok-3-mini": "gpt-5-nano",
}

const AGENTS_TO_REMOVE = new Set(["prometheus", "metis", "momus", "multimodal-looker", "sisyphus-junior"])

const FIELDS_TO_REMOVE = new Set(["claude_code", "babysitting", "browser_automation"])

export function detectLegacyConfig(workingDir: string): boolean {
  const projectPaths = LEGACY_CONFIG_PATHS.map((p) => path.join(workingDir, p))
  const allPaths = [...projectPaths, ...LEGACY_USER_CONFIG_PATHS]

  for (const configPath of allPaths) {
    if (fs.existsSync(configPath)) {
      return true
    }
  }

  return false
}

export function migrateConfig(legacy: Record<string, unknown>): OhMyOpenCodexConfig {
  const migrated: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(legacy)) {
    if (FIELDS_TO_REMOVE.has(key)) {
      continue
    }

    if (key === "agents" && typeof value === "object" && value !== null && !Array.isArray(value)) {
      migrated[key] = migrateAgents(value as Record<string, unknown>)
      continue
    }

    if (key === "categories" && typeof value === "object" && value !== null && !Array.isArray(value)) {
      migrated[key] = migrateCategories(value as Record<string, unknown>)
      continue
    }

    migrated[key] = value
  }

  const result = OhMyOpenCodexConfigSchema.safeParse(migrated)
  return result.success ? result.data : (migrated as OhMyOpenCodexConfig)
}

function migrateAgents(agents: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {}

  for (const [agentName, agentConfig] of Object.entries(agents)) {
    if (AGENTS_TO_REMOVE.has(agentName)) {
      continue
    }

    if (typeof agentConfig === "object" && agentConfig !== null && !Array.isArray(agentConfig)) {
      migrated[agentName] = migrateAgentConfig(agentConfig as Record<string, unknown>)
    } else {
      migrated[agentName] = agentConfig
    }
  }

  return migrated
}

function migrateAgentConfig(config: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (key === "model" && typeof value === "string") {
      migrated[key] = OPENAI_MODEL_MAP[value] ?? value
      continue
    }

    migrated[key] = value
  }

  return migrated
}

function migrateCategories(categories: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {}

  for (const [categoryName, categoryConfig] of Object.entries(categories)) {
    if (typeof categoryConfig === "object" && categoryConfig !== null && !Array.isArray(categoryConfig)) {
      migrated[categoryName] = migrateCategoryConfig(categoryConfig as Record<string, unknown>)
    } else {
      migrated[categoryName] = categoryConfig
    }
  }

  return migrated
}

function migrateCategoryConfig(config: Record<string, unknown>): Record<string, unknown> {
  const migrated: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(config)) {
    if (key === "model" && typeof value === "string") {
      migrated[key] = OPENAI_MODEL_MAP[value] ?? value
      continue
    }

    migrated[key] = value
  }

  return migrated
}

export function autoMigrate(workingDir: string): { migrated: boolean; changes: string[] } {
  const changes: string[] = []

  const projectPaths = LEGACY_CONFIG_PATHS.map((p) => path.join(workingDir, p))
  let legacyPath: string | undefined

  for (const configPath of projectPaths) {
    if (fs.existsSync(configPath)) {
      legacyPath = configPath
      break
    }
  }

  if (!legacyPath) {
    return { migrated: false, changes: [] }
  }

  try {
    const content = fs.readFileSync(legacyPath, "utf-8")
    const legacy = parseJsonc<unknown>(content)

    if (typeof legacy !== "object" || legacy === null || Array.isArray(legacy)) {
      return { migrated: false, changes: [] }
    }

    const migrated = migrateConfig(legacy as Record<string, unknown>)

    const newConfigDir = path.join(workingDir, ".codex")
    if (!fs.existsSync(newConfigDir)) {
      fs.mkdirSync(newConfigDir, { recursive: true })
    }

    const newConfigPath = path.join(newConfigDir, "oh-my-opencodex.jsonc")
    fs.writeFileSync(newConfigPath, JSON.stringify(migrated, null, 2) + "\n", "utf-8")

    changes.push(`Migrated config from ${legacyPath} to ${newConfigPath}`)

    if (Object.keys(migrated.agents ?? {}).length < Object.keys((legacy as Record<string, unknown>).agents ?? {}).length) {
      changes.push("Removed unsupported agents: prometheus, metis, momus, multimodal-looker, sisyphus-junior")
    }

    return { migrated: true, changes }
  } catch (error) {
    log(`Failed to auto-migrate config: ${error}`)
    return { migrated: false, changes: [] }
  }
}
