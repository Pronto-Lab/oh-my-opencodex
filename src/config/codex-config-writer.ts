import type { OhMyCodexConfig } from "./schema/oh-my-codex-config"
import { toToml } from "../shared/toml-writer"

const WEBSEARCH_URL = "https://mcp.exa.ai"
const CONTEXT7_URL = "https://mcp.context7.com/mcp"
const GREP_APP_URL = "https://mcp.grep.app"

export function generateCodexConfig(
  config: OhMyCodexConfig,
  workingDirectory: string,
): string {
  const sections: string[] = []

  sections.push(
    toToml({
      model: config.agents?.sisyphus?.model ?? "gpt-5.3-codex",
    }),
  )

  sections.push(
    section("permissions", {
      approval_policy: config.approval_policy ?? "on-request",
      sandbox_mode: config.sandbox_mode ?? "workspace-write",
    }),
  )

  sections.push(
    section("features", {
      web_search_request: config.web_search_mode !== "disabled",
    }),
  )

  sections.push(buildMcpServersToml(config, workingDirectory))

  if (config.notification?.command) {
    sections.push(
      section("notify", {
        command: config.notification.command,
        args: config.notification.args ?? [],
      }),
    )
  }

  return sections.filter(Boolean).join("\n\n")
}

function section(name: string, values: Record<string, unknown>): string {
  return `[${name}]\n${toToml(values)}`
}

function buildMcpServersToml(config: OhMyCodexConfig, workingDir: string): string {
  const lines: string[] = []
  const disabled = new Set(config.disabled_mcps ?? [])

  lines.push("[mcp_servers.oh-my-codex]")
  lines.push(toToml({
    command: "oh-my-codex",
    args: ["mcp-server", "--dir", workingDir],
    enabled: true,
  }))
  lines.push("")

  if (!disabled.has("websearch")) {
    lines.push("[mcp_servers.websearch]")
    lines.push(toToml({ type: "http", url: WEBSEARCH_URL, enabled: true }))
    lines.push("")
  }

  if (!disabled.has("context7")) {
    lines.push("[mcp_servers.context7]")
    lines.push(toToml({ type: "http", url: CONTEXT7_URL, enabled: true }))
    lines.push("")
  }

  if (!disabled.has("grep_app")) {
    lines.push("[mcp_servers.grep_app]")
    lines.push(toToml({ type: "http", url: GREP_APP_URL, enabled: true }))
    lines.push("")
  }

  return lines.join("\n").trim()
}
