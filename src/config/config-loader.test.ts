import { describe, expect, it } from "bun:test"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type ConfigLoaderModule = typeof import("./config-loader")

async function withTempDirs(): Promise<{ home: string; working: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "oh-my-codex-config-loader-"))
  return {
    home: path.join(root, "home"),
    working: path.join(root, "workspace"),
  }
}

async function importConfigLoader(home: string): Promise<ConfigLoaderModule> {
  const previousHome = process.env.HOME
  process.env.HOME = home
  try {
    const moduleUrl = new URL(
      `./config-loader.ts?test=${Date.now()}-${Math.random()}`,
      import.meta.url,
    )
    return (await import(moduleUrl.href)) as ConfigLoaderModule
  } finally {
    process.env.HOME = previousHome
  }
}

describe("loadConfig", () => {
  it("parses JSONC config files with comments and trailing commas", async () => {
    const { home, working } = await withTempDirs()
    await mkdir(path.join(home, ".config", "codex"), { recursive: true })
    await mkdir(path.join(working, ".codex"), { recursive: true })

    const configBody = `{
      // enable live search
      "web_search_mode": "live",
      "disabled_hooks": ["think-mode-hook",],
    }`
    await writeFile(path.join(working, ".codex", "oh-my-codex.jsonc"), configBody, "utf-8")

    const { loadConfig } = await importConfigLoader(home)
    const result = loadConfig(working)

    expect(result.web_search_mode).toBe("live")
    expect(result.disabled_hooks).toEqual(["think-mode-hook"])
  })

  it("merges user and project configs with project precedence", async () => {
    const { home, working } = await withTempDirs()
    await mkdir(path.join(home, ".config", "codex"), { recursive: true })
    await mkdir(path.join(working, ".codex"), { recursive: true })

    await writeFile(
      path.join(home, ".config", "codex", "oh-my-codex.jsonc"),
      JSON.stringify(
        {
          web_search_mode: "cached",
          agents: { sisyphus: { model: "gpt-5.1", reasoning_effort: "medium" } },
        },
        null,
        2,
      ),
      "utf-8",
    )
    await writeFile(
      path.join(working, ".codex", "oh-my-codex.jsonc"),
      JSON.stringify(
        {
          web_search_mode: "live",
          agents: { sisyphus: { model: "gpt-5.3-codex" } },
        },
        null,
        2,
      ),
      "utf-8",
    )

    const { loadConfig } = await importConfigLoader(home)
    const result = loadConfig(working)

    expect(result.web_search_mode).toBe("live")
    expect(result.agents?.sisyphus?.model).toBe("gpt-5.3-codex")
  })

  it("returns merged raw config when schema validation fails", async () => {
    const { home, working } = await withTempDirs()
    await mkdir(path.join(home, ".config", "codex"), { recursive: true })
    await mkdir(path.join(working, ".codex"), { recursive: true })

    await writeFile(
      path.join(working, ".codex", "oh-my-codex.jsonc"),
      JSON.stringify({ approval_policy: "invalid-policy" }, null, 2),
      "utf-8",
    )

    const { loadConfig } = await importConfigLoader(home)
    const result = loadConfig(working)

    expect((result as Record<string, unknown>).approval_policy).toBe("invalid-policy")
  })

  it("returns an empty object when config files are absent", async () => {
    const { home, working } = await withTempDirs()
    await mkdir(path.join(home, ".config", "codex"), { recursive: true })
    await mkdir(working, { recursive: true })

    const { loadConfig } = await importConfigLoader(home)
    const result = loadConfig(working)

    expect(result).toEqual({})
  })
})
