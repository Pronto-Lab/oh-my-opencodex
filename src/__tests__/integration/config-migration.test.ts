import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { loadConfig } from "../../config/config-loader"
import { generateCodexConfig } from "../../config/codex-config-writer"
import { autoMigrate, detectLegacyConfig } from "../../config/migration"

const tempDirs = new Set<string>()

async function newTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "omc-migrate-"))
  tempDirs.add(dir)
  return dir
}

async function writeLegacyConfig(workingDirectory: string): Promise<void> {
  const legacyDir = path.join(workingDirectory, ".opencode")
  await mkdir(legacyDir, { recursive: true })
  await writeFile(
    path.join(legacyDir, "oh-my-opencodex.jsonc"),
    JSON.stringify({
      claude_code: { enabled: true },
      agents: {
        sisyphus: { model: "claude-opus-4-20250514", reasoning_effort: "high" },
        prometheus: { model: "claude-sonnet-4-20250514" },
      },
      categories: {
        explore: { model: "grok-3-mini" },
      },
    }, null, 2),
    "utf-8",
  )
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  tempDirs.clear()
})

describe("integration/config-migration", () => {
  it("migrates legacy JSONC config and keeps new keys", async () => {
    const workingDirectory = await newTempDir()
    await writeLegacyConfig(workingDirectory)

    expect(detectLegacyConfig(workingDirectory)).toBe(true)

    const migration = autoMigrate(workingDirectory)
    expect(migration.migrated).toBe(true)
    expect(migration.changes.length).toBeGreaterThan(0)

    const loaded = loadConfig(workingDirectory)
    expect(loaded.agents?.sisyphus?.model).toBe("gpt-5.3-codex")
    expect(loaded.agents?.prometheus).toBeUndefined()
    expect(loaded.categories?.explore?.model).toBe("gpt-5-nano")
  })

  it("runs full legacy -> load -> migrate -> TOML generation path", async () => {
    const workingDirectory = await newTempDir()
    await writeLegacyConfig(workingDirectory)

    autoMigrate(workingDirectory)
    const loaded = loadConfig(workingDirectory)
    const toml = generateCodexConfig(loaded, workingDirectory)

    expect(toml.includes("[permissions]")).toBe(true)
    expect(toml.includes("[mcp_servers.oh-my-opencodex]")).toBe(true)
    expect(toml.includes("command = \"oh-my-opencodex\"")).toBe(true)
    expect(toml.includes("sandbox_mode")).toBe(true)

    const writtenConfig = await readFile(path.join(workingDirectory, ".codex", "oh-my-opencodex.jsonc"), "utf-8")
    expect(writtenConfig.includes("gpt-5.3-codex")).toBe(true)
  })
})
