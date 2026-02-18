import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import * as fs from "fs"
import * as path from "path"

export function registerResources(
  server: McpServer,
  _config: OhMyCodexConfig,
  workingDirectory: string,
): void {
  server.registerResource(
    "project_agents_md",
    "project://agents-md",
    {
      title: "AGENTS.md",
      description: "Project architecture and agent instructions",
      mimeType: "text/markdown",
    },
    async () => {
      const agentsPath = path.join(workingDirectory, "AGENTS.md")
      const text = fs.existsSync(agentsPath)
        ? await fs.promises.readFile(agentsPath, "utf8")
        : ""

      return {
        contents: [
          {
            uri: "project://agents-md",
            mimeType: "text/markdown",
            text,
          },
        ],
      }
    },
  )
}
