import { describe, expect, it } from "bun:test"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { autoMigrate, migrateConfig } from "./migration"

describe("migrateConfig", () => {
  it("migrates legacy keys, removes unsupported agents, and maps old model ids", () => {
    const legacy = {
      claude_code: { enabled: true },
      agents: {
        sisyphus: { model: "claude-opus-4-20250514" },
        prometheus: { model: "gpt-5.1" },
      },
      categories: {
        quick: { model: "grok-3-mini", description: "quick tasks" },
      },
    }

    const migrated = migrateConfig(legacy)

    expect((migrated as Record<string, unknown>).claude_code).toBeUndefined()
    expect(migrated.agents?.prometheus).toBeUndefined()
    expect(migrated.agents?.sisyphus?.model).toBe("gpt-5.3-codex")
    expect(migrated.categories?.quick?.model).toBe("gpt-5-nano")
  })

  it("keeps current config unchanged when no migration is needed", () => {
    const current = {
      approval_policy: "on-request",
      agents: {
        sisyphus: { model: "gpt-5.3-codex", reasoning_effort: "high" },
      },
      categories: {
        deep: { model: "gpt-5.1", description: "deep work" },
      },
    }

    const migrated = migrateConfig(current)

    expect(migrated).toEqual(current)
  })
})

describe("autoMigrate", () => {
  it("returns no-op when no legacy config file exists", async () => {
    const workingDir = await mkdtemp(path.join(os.tmpdir(), "oh-my-codex-migration-"))
    const result = autoMigrate(workingDir)

    expect(result).toEqual({ migrated: false, changes: [] })
  })

  it("writes migrated config into .codex when legacy file exists", async () => {
    const workingDir = await mkdtemp(path.join(os.tmpdir(), "oh-my-codex-migration-"))
    const legacyDir = path.join(workingDir, ".opencode")
    await mkdir(legacyDir, { recursive: true })

    await writeFile(
      path.join(legacyDir, "oh-my-opencodex.jsonc"),
      JSON.stringify(
        {
          agents: {
            sisyphus: { model: "claude-sonnet-4-20250514" },
            metis: { model: "gpt-5.1" },
          },
        },
        null,
        2,
      ),
      "utf-8",
    )

    const result = autoMigrate(workingDir)

    expect(result.migrated).toBe(true)
    expect(result.changes.length).toBeGreaterThan(0)

    const migratedFile = await Bun.file(
      path.join(workingDir, ".codex", "oh-my-codex.jsonc"),
    ).json()
    expect(migratedFile.agents.sisyphus.model).toBe("gpt-5.3-codex")
    expect(migratedFile.agents.metis).toBeUndefined()
  })
})
