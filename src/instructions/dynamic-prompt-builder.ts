import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"

type ToolSpec = { name: string; description: string }

const MCP_TOOL_SPECS: ToolSpec[] = [
  { name: "lsp_goto_definition", description: "Jump to where a symbol is defined." },
  { name: "lsp_find_references", description: "Find every symbol usage across the workspace." },
  { name: "lsp_symbols", description: "List document/workspace symbols for fast navigation." },
  { name: "lsp_diagnostics", description: "Read language-server errors and warnings." },
  { name: "lsp_prepare_rename", description: "Check if a symbol can be renamed safely." },
  { name: "lsp_rename", description: "Rename symbol usages across the project." },
  { name: "ast_grep_search", description: "Search AST patterns with language-aware matching." },
  { name: "ast_grep_replace", description: "Apply AST-aware code rewrites safely." },
  { name: "grep", description: "Search text patterns in file contents." },
  { name: "glob", description: "Find files by glob path patterns." },
  { name: "call_agent", description: "Run a specific specialist agent by name." },
  { name: "delegate_task", description: "Delegate work by category-model routing." },
  { name: "background_output", description: "Read results from running background tasks." },
  { name: "background_cancel", description: "Cancel one or more background tasks." },
  { name: "look_at", description: "Analyze images/PDFs for extracted insights." },
  { name: "interactive_bash", description: "Interact with long-running TUI/tmux sessions." },
  { name: "skill", description: "Load skill instructions for specialized workflows." },
  { name: "skill_mcp", description: "Invoke MCP tools embedded inside skills." },
  { name: "slashcommand", description: "Run built-in slash command workflows." },
  { name: "session_list", description: "List historical sessions with metadata." },
  { name: "session_read", description: "Read chat/message history for a session." },
  { name: "session_search", description: "Search full-text across session messages." },
]

const DEFAULT_AGENT_MODELS: Record<string, string> = {
  oracle: "gpt-5.2",
  explore: "gpt-5-nano",
  librarian: "gpt-5.1",
}

const DEFAULT_CATEGORY_MODELS: Record<string, string> = {
  quick: "gpt-5-nano",
  deep: "gpt-5.1",
  ultrabrain: "gpt-5.3-codex",
}

function table(headers: string[], rows: string[][]): string {
  const header = `| ${headers.join(" | ")} |`
  const sep = `| ${headers.map(() => "---").join(" | ")} |`
  const body = rows.map((row) => `| ${row.join(" | ")} |`).join("\n")
  return [header, sep, body].filter(Boolean).join("\n")
}

export function buildToolGuidanceSection(config: OhMyCodexConfig): string {
  const disabled = new Set(config.disabled_tools ?? [])
  const rows = MCP_TOOL_SPECS.map((tool) => [
    `\`${tool.name}\``,
    tool.description,
    disabled.has(tool.name) ? "disabled" : "enabled",
  ])
  return [
    "## MCP Tool Guidance",
    "",
    "Use these 22 MCP tools intentionally. Prefer specialized tools over shell when possible.",
    "",
    table(["Tool", "Use When", "Status"], rows),
  ].join("\n")
}

export function buildDelegationSection(config: OhMyCodexConfig): string {
  const agentRows = ["explore", "librarian", "oracle"].map((agent) => {
    const model = config.agents?.[agent]?.model ?? DEFAULT_AGENT_MODELS[agent]
    return [`\`${agent}\``, `\`${model}\``]
  })
  return [
    "## Delegation Rules",
    "",
    "- Use `call_agent` for named specialist invocation (`explore`, `librarian`, `oracle`).",
    "- Use `delegate_task` for category-driven routing where the model comes from category config.",
    "- Prefer parallel delegation for independent subtasks, then reconcile outputs before finalizing.",
    "",
    table(["Agent", "Default Model"], agentRows),
  ].join("\n")
}

export function buildCategorySection(config: OhMyCodexConfig): string {
  const merged = { ...DEFAULT_CATEGORY_MODELS }
  for (const [name, category] of Object.entries(config.categories ?? {})) {
    merged[name] = category.model
  }
  const rows = Object.entries(merged)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, model]) => {
      const description = config.categories?.[name]?.description
        ?? (name === "quick"
          ? "Fast, narrow tasks and lookups."
          : name === "deep"
            ? "Implementation with careful reasoning."
            : name === "ultrabrain"
              ? "Highest-depth synthesis and architecture."
              : "Custom category from configuration.")
      return [`\`${name}\``, `\`${model}\``, description]
    })

  return [
    "## Category Routing",
    "",
    "Use `delegate_task` with a category to route work to its configured model.",
    "",
    table(["Category", "Model", "Intent"], rows),
  ].join("\n")
}
