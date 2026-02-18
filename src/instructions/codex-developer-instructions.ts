import type { OhMyOpenCodexConfig } from "../config/schema/oh-my-opencodex-config"

function buildMcpToolReminder(config: OhMyOpenCodexConfig): string {
  const disabled = new Set(config.disabled_tools ?? [])
  const tools = [
    "lsp_goto_definition", "lsp_find_references", "lsp_symbols",
    "lsp_diagnostics", "lsp_rename", "lsp_prepare_rename",
    "ast_grep_search", "ast_grep_replace",
    "grep", "glob",
    "call_agent", "delegate_task",
    "background_output", "background_cancel",
    "look_at", "interactive_bash",
    "skill", "skill_mcp", "slashcommand",
    "session_list", "session_read", "session_search",
  ].filter((t) => !disabled.has(t))

  return `You have ${tools.length} MCP tools from oh-my-opencodex. Use them:
- Refactoring: lsp_rename > manual find-replace
- Diagnostics: lsp_diagnostics on every changed file
- Search: ast_grep_search for structural patterns, grep for text
- Delegation: call_agent (by name) or delegate_task (by category)
- Background: fire explore/librarian in background, collect with background_output`
}

function buildContinuationReminder(): string {
  return `CRITICAL BEHAVIORAL RULE — Todo Continuation:
When you have created a todo list and incomplete items remain, you MUST continue working.
Do NOT end your response while todos are pending. Keep executing until all items are completed or cancelled.
This is non-negotiable. Incomplete work = failed task.`
}

function buildCodeStandards(): string {
  return `Code quality standards (non-negotiable):
- No \`as any\`, \`@ts-ignore\`, \`@ts-expect-error\`
- No emoji in code/comments unless user asks
- No unnecessary comments; comment only non-obvious reasoning
- Match existing project patterns when disciplined
- Minimal diff, maximal clarity
- Verify with lsp_diagnostics + build/test before claiming done`
}

function buildCommunicationStyle(): string {
  return `Communication:
- Start working immediately, no preamble or acknowledgments
- Be concise and direct
- No flattery ("Great question!")
- Surface risks early with concrete alternatives
- Use todo list for progress tracking, not status updates`
}

export function generateDeveloperInstructions(config: OhMyOpenCodexConfig): string {
  const sections = [
    buildContinuationReminder(),
    buildMcpToolReminder(config),
    buildCodeStandards(),
    buildCommunicationStyle(),
  ]

  if (config.agents?.sisyphus?.prompt_append) {
    sections.push(`User-provided instructions:\n${config.agents.sisyphus.prompt_append}`)
  }

  return sections.join("\n\n")
}
