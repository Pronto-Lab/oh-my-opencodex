import { describe, expect, it } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createMcpServer } from "./server"

const EXPECTED_TOOL_COUNT = 23

function minimalConfig() {
  return {}
}

async function createConnectedClient() {
  const server = createMcpServer(minimalConfig(), "/tmp/test-workdir")
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  const client = new Client({ name: "test-client", version: "1.0.0" })

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])

  return { client, server }
}

describe("MCP Server", () => {
  it("creates a server that accepts connections", async () => {
    const { client } = await createConnectedClient()
    expect(client).toBeDefined()
    await client.close()
  })

  it("registers all expected tools", async () => {
    const { client } = await createConnectedClient()
    const { tools } = await client.listTools()

    expect(tools.length).toBe(EXPECTED_TOOL_COUNT)
    await client.close()
  })

  it("registers core tool categories", async () => {
    const { client } = await createConnectedClient()
    const { tools } = await client.listTools()
    const toolNames = new Set(tools.map((t) => t.name))

    const lspTools = ["lsp_goto_definition", "lsp_find_references", "lsp_symbols", "lsp_diagnostics", "lsp_prepare_rename", "lsp_rename"]
    for (const name of lspTools) {
      expect(toolNames.has(name)).toBe(true)
    }

    const searchTools = ["ast_grep_search", "ast_grep_replace", "grep", "glob"]
    for (const name of searchTools) {
      expect(toolNames.has(name)).toBe(true)
    }

    const sessionTools = ["session_list", "session_read", "session_search", "session_info", "background_output", "background_cancel", "call_agent", "delegate_task"]
    for (const name of sessionTools) {
      expect(toolNames.has(name)).toBe(true)
    }

    const utilityTools = ["look_at", "interactive_bash", "skill", "skill_mcp", "slashcommand"]
    for (const name of utilityTools) {
      expect(toolNames.has(name)).toBe(true)
    }

    await client.close()
  })

  it("respects disabled_tools config", async () => {
    const config = { disabled_tools: ["lsp_rename", "grep", "look_at"] }
    const server = createMcpServer(config, "/tmp/test-workdir")
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: "test-client", version: "1.0.0" })

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ])

    const { tools } = await client.listTools()
    const toolNames = new Set(tools.map((t) => t.name))

    expect(toolNames.has("lsp_rename")).toBe(false)
    expect(toolNames.has("grep")).toBe(false)
    expect(toolNames.has("look_at")).toBe(false)
    expect(toolNames.has("lsp_goto_definition")).toBe(true)
    expect(tools.length).toBe(EXPECTED_TOOL_COUNT - 3)

    await client.close()
  })

  it("registers the AGENTS.md resource", async () => {
    const { client } = await createConnectedClient()
    const { resources } = await client.listResources()

    expect(resources.length).toBeGreaterThanOrEqual(1)

    const agentsMd = resources.find((r) => r.uri === "project://agents-md")
    expect(agentsMd).toBeDefined()
    expect(agentsMd?.name).toBe("project_agents_md")

    await client.close()
  })
})
