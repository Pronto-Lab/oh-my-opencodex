import { describe, expect, it } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { loadConfig } from "../config/config-loader"
import { generateCodexConfig } from "../config/codex-config-writer"
import { generateInstructions } from "../instructions/agents-md-generator"
import { generateRulesFiles } from "../instructions/rules-generator"
import { CodexWrapper } from "../orchestrator/codex-wrapper"
import { EventLoop } from "../orchestrator/event-loop"
import { ThreadPool } from "../orchestrator/thread-pool"
import { HookRegistry } from "../event-hooks/hook-registry"
import { registerAllHooks } from "../event-hooks/register-all-hooks"
import { createMcpServer } from "../mcp-server/server"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

function createWorkspace(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-pipeline-"))
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, "utf-8")
  }
  return dir
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

describe("E2E Pipeline", () => {
  it("loads config from workspace", () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": JSON.stringify({
        agents: { sisyphus: { model: "gpt-5.3-codex" } },
        sandbox_mode: "workspace-write",
      }),
    })

    try {
      const config = loadConfig(dir)
      expect(config.agents?.sisyphus?.model).toBe("gpt-5.3-codex")
      expect(config.sandbox_mode).toBe("workspace-write")
    } finally {
      cleanup(dir)
    }
  })

  it("generates valid codex config.toml from loaded config", () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": JSON.stringify({
        approval_policy: "on-request",
      }),
    })

    try {
      const config = loadConfig(dir)
      const toml = generateCodexConfig(config, dir)

      expect(toml).toContain('model = "gpt-5.3-codex"')
      expect(toml).toContain("[permissions]")
      expect(toml).toContain("[mcp_servers.oh-my-opencodex]")
      expect(toml).toContain(dir)
    } finally {
      cleanup(dir)
    }
  })

  it("generates AGENTS.md instructions under 32KB", () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": "{}",
    })

    try {
      const config = loadConfig(dir)
      const instructions = generateInstructions("sisyphus", config)

      expect(instructions.length).toBeGreaterThan(500)
      expect(new TextEncoder().encode(instructions).length).toBeLessThanOrEqual(32768)
      expect(instructions).toContain("Sisyphus")
    } finally {
      cleanup(dir)
    }
  })

  it("generates rules files in workspace", async () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": JSON.stringify({
        approval_policy: "on-failure",
      }),
    })

    try {
      const config = loadConfig(dir)
      const paths = await generateRulesFiles(config, dir)

      expect(paths.length).toBe(2)
      for (const filePath of paths) {
        expect(fs.existsSync(filePath)).toBe(true)
      }

      const approvalRules = fs.readFileSync(paths[0]!, "utf-8")
      expect(approvalRules).toContain("on-failure")
    } finally {
      cleanup(dir)
    }
  })

  it("creates CodexWrapper with correct config", () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": JSON.stringify({
        agents: { sisyphus: { model: "gpt-5.3-codex" } },
      }),
    })

    try {
      const config = loadConfig(dir)
      const instructions = generateInstructions("sisyphus", config)

      const wrapper = new CodexWrapper({
        config,
        instructions,
        workingDirectory: dir,
        agentName: "sisyphus",
      })

      expect(wrapper.resolveModel()).toBe("gpt-5.3-codex")
      expect(wrapper.resolveModel("oracle")).toBe("gpt-5.2")
      expect(wrapper.resolveModel("explore")).toBe("gpt-5-nano")
      expect(wrapper.getThreadId()).toBeNull()
    } finally {
      cleanup(dir)
    }
  })

  it("wires orchestrator components together", () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": "{}",
    })

    try {
      const config = loadConfig(dir)
      const instructions = generateInstructions("sisyphus", config)
      const hookRegistry = new HookRegistry(config.disabled_hooks ?? [])
      const wrapper = new CodexWrapper({
        config,
        instructions,
        workingDirectory: dir,
        agentName: "sisyphus",
      })
      const threadPool = new ThreadPool({ maxConcurrent: 5 })
      threadPool.setCodexWrapper(wrapper)
      threadPool.setHookRegistry(hookRegistry)
      const eventLoop = new EventLoop(hookRegistry)
      registerAllHooks(hookRegistry, config, dir)

      expect(threadPool.getRunningCount()).toBe(0)
      expect(threadPool.listTasks()).toEqual([])
      expect(eventLoop).toBeDefined()
    } finally {
      cleanup(dir)
    }
  })

  it("MCP server starts and lists all tools for the loaded config", async () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": "{}",
    })

    try {
      const config = loadConfig(dir)
      const server = createMcpServer(config, dir)
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      const client = new Client({ name: "e2e-client", version: "1.0.0" })

      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ])

      const { tools } = await client.listTools()
      expect(tools.length).toBe(23)

      const { resources } = await client.listResources()
      expect(resources.length).toBeGreaterThanOrEqual(1)

      await client.close()
    } finally {
      cleanup(dir)
    }
  })

  it("full pipeline: config -> instructions -> wrapper -> hooks -> MCP", async () => {
    const dir = createWorkspace({
      ".codex/oh-my-opencodex.jsonc": JSON.stringify({
        agents: {
          sisyphus: { model: "gpt-5.3-codex" },
          oracle: { model: "gpt-5.2" },
        },
        approval_policy: "on-request",
        sandbox_mode: "workspace-write",
        categories: {
          quick: { model: "gpt-5-nano", description: "Fast tasks" },
        },
      }),
    })

    try {
      const config = loadConfig(dir)

      const toml = generateCodexConfig(config, dir)
      expect(toml).toContain("[mcp_servers.oh-my-opencodex]")

      const instructions = generateInstructions("sisyphus", config)
      expect(new TextEncoder().encode(instructions).length).toBeLessThanOrEqual(32768)

      await generateRulesFiles(config, dir)
      expect(fs.existsSync(path.join(dir, ".codex/rules/approval-policy.rules"))).toBe(true)

      const wrapper = new CodexWrapper({
        config,
        instructions,
        workingDirectory: dir,
        agentName: "sisyphus",
      })
      expect(wrapper.resolveModel()).toBe("gpt-5.3-codex")

      const hookRegistry = new HookRegistry([])
      registerAllHooks(hookRegistry, config, dir)

      const threadPool = new ThreadPool({ maxConcurrent: 3 })
      threadPool.setCodexWrapper(wrapper)
      threadPool.setHookRegistry(hookRegistry)

      const server = createMcpServer(config, dir)
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      const client = new Client({ name: "e2e-full", version: "1.0.0" })

      await Promise.all([
        client.connect(clientTransport),
        server.connect(serverTransport),
      ])

      const { tools } = await client.listTools()
      expect(tools.length).toBe(23)

      await client.close()
    } finally {
      cleanup(dir)
    }
  })
})
