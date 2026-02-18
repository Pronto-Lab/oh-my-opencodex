import { describe, expect, it } from "bun:test"
import { generateCodexConfig } from "./codex-config-writer"

describe("generateCodexConfig", () => {
  it("generates TOML with model and permission sections", () => {
    const config = {
      agents: { sisyphus: { model: "gpt-5.3-codex" } },
      approval_policy: "on-failure",
      sandbox_mode: "danger-full-access",
      web_search_mode: "live",
    }

    const toml = generateCodexConfig(config, "/tmp/workdir")

    expect(toml).toContain('model = "gpt-5.3-codex"')
    expect(toml).toContain("[permissions]")
    expect(toml).toContain('approval_policy = "on-failure"')
    expect(toml).toContain('sandbox_mode = "danger-full-access"')
  })

  it("generates MCP server sections and respects disabled MCPs", () => {
    const config = {
      disabled_mcps: ["context7", "grep_app"],
    }

    const toml = generateCodexConfig(config, "/repo")

    expect(toml).toContain("[mcp_servers.oh-my-opencodex]")
    expect(toml).toContain('args = ["mcp-server", "--dir", "/repo"]')
    expect(toml).toContain("[mcp_servers.websearch]")
    expect(toml).not.toContain("[mcp_servers.context7]")
    expect(toml).not.toContain("[mcp_servers.grep_app]")
  })

  it("includes notification command with args when configured", () => {
    const config = {
      notification: {
        command: "terminal-notifier",
        args: ["-title", "Done"],
      },
    }

    const toml = generateCodexConfig(config, "/tmp")

    expect(toml).toContain("[notify]")
    expect(toml).toContain('command = "terminal-notifier"')
    expect(toml).toContain('args = ["-title", "Done"]')
  })

  it("falls back to defaults when model provider config is missing", () => {
    const toml = generateCodexConfig({}, "/tmp")

    expect(toml).toContain('model = "gpt-5.3-codex"')
    expect(toml).toContain('approval_policy = "on-request"')
    expect(toml).toContain('sandbox_mode = "workspace-write"')
  })

  it("always includes oh-my-opencodex MCP server even when all MCPs disabled", () => {
    const config = {
      disabled_mcps: ["websearch", "context7", "grep_app"],
    }

    const toml = generateCodexConfig(config, "/workspace")

    expect(toml).toContain("[mcp_servers.oh-my-opencodex]")
    expect(toml).toContain('command = "oh-my-opencodex"')
    expect(toml).toContain('args = ["mcp-server", "--dir", "/workspace"]')
    expect(toml).toContain("enabled = true")
    expect(toml).not.toContain("[mcp_servers.websearch]")
    expect(toml).not.toContain("[mcp_servers.context7]")
    expect(toml).not.toContain("[mcp_servers.grep_app]")
  })

  it("generates valid TOML structure with all sections", () => {
    const config = {
      agents: { sisyphus: { model: "gpt-5.3-codex" } },
      approval_policy: "on-request",
      sandbox_mode: "workspace-write",
      web_search_mode: "live",
      notification: { command: "notify-send", args: ["done"] },
    }

    const toml = generateCodexConfig(config, "/project")
    const sections = toml.split("\n\n")

    expect(sections.length).toBeGreaterThanOrEqual(3)

    expect(toml).toContain('model = "gpt-5.3-codex"')
    expect(toml).toContain("[permissions]")
    expect(toml).toContain("[features]")
    expect(toml).toContain("[mcp_servers.oh-my-opencodex]")
    expect(toml).toContain("[notify]")
  })
})
