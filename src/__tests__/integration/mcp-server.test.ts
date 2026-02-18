import { afterEach, describe, expect, it, mock } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type MockToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>

class MockMcpServer {
  static instances: MockMcpServer[] = []

  readonly tools = new Map<string, { handler: MockToolHandler }>()
  connected = false

  constructor(_meta: Record<string, unknown>) {
    MockMcpServer.instances.push(this)
  }

  registerTool(name: string, _schema: Record<string, unknown>, handler: MockToolHandler): void {
    this.tools.set(name, { handler })
  }

  registerResource(): void {}

  async connect(_transport: unknown): Promise<void> {
    this.connected = true
  }
}

class MockStdioServerTransport {}

mock.module("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: MockMcpServer,
}))

mock.module("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: MockStdioServerTransport,
}))

const tempDirs = new Set<string>()

async function newTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "omc-mcp-"))
  tempDirs.add(dir)
  return dir
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true })
  }
  tempDirs.clear()
  MockMcpServer.instances.length = 0
})

describe("integration/mcp-server", () => {
  it("creates MCP server with all tools registered", async () => {
    const { createMcpServer } = await import("../../mcp-server/server")
    const workingDirectory = await newTempDir()

    const server = createMcpServer({}, workingDirectory) as unknown as MockMcpServer

    expect(server.tools.size).toBe(23)
    expect(server.tools.has("session_list")).toBe(true)
    expect(server.tools.has("lsp_diagnostics")).toBe(true)
  })

  it("startMcpServer connects server without real stdio transport", async () => {
    const { startMcpServer } = await import("../../mcp-server/server")
    const workingDirectory = await newTempDir()

    await startMcpServer({}, workingDirectory)

    expect(MockMcpServer.instances.length).toBe(1)
    expect(MockMcpServer.instances[0]?.connected).toBe(true)
    expect(MockMcpServer.instances[0]?.tools.size).toBe(23)
  })

  it("runs a registered tool and returns MCP text content format", async () => {
    const { createMcpServer } = await import("../../mcp-server/server")
    const workingDirectory = await newTempDir()
    const server = createMcpServer({}, workingDirectory) as unknown as MockMcpServer

    const sessionListTool = server.tools.get("session_list")
    expect(sessionListTool).toBeDefined()

    const result = await sessionListTool!.handler({})

    expect(Array.isArray(result.content)).toBe(true)
    expect(result.content[0]?.type).toBe("text")
    expect(typeof result.content[0]?.text).toBe("string")
  })
})
