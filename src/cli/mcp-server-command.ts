import * as path from "path"
import pc from "picocolors"
import { loadConfig } from "../config/config-loader"
import { startMcpServer } from "../mcp-server/server"

type McpServerCommandOptions = {
  dir?: string
}

export async function runMcpServerCommand(options: McpServerCommandOptions): Promise<void> {
  const workingDirectory = path.resolve(options.dir ?? process.cwd())
  const config = loadConfig(workingDirectory)

  console.error(pc.dim(`Starting MCP server in ${workingDirectory}`))
  await startMcpServer(config, workingDirectory)
}
