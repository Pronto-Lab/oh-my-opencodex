import { describe, expect, it } from "bun:test"
import { generateInstructions } from "./agents-md-generator"

const MAX_BYTES = 32768

describe("generateInstructions", () => {
  it("generates instructions for sisyphus agent", () => {
    const result = generateInstructions("sisyphus", {})

    expect(result.length).toBeGreaterThan(100)
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(MAX_BYTES)
  })

  it("generates instructions for all known agents", () => {
    const agents = ["sisyphus", "hephaestus", "oracle", "explore", "librarian", "atlas"]

    for (const agent of agents) {
      const result = generateInstructions(agent, {})
      expect(result.length).toBeGreaterThan(50)
      expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(MAX_BYTES)
    }
  })

  it("generates fallback for unknown agent", () => {
    const result = generateInstructions("nonexistent", {})

    expect(result).toContain("nonexistent")
    expect(result).toContain("oh-my-codex")
  })

  it("sisyphus includes its own tool guidance and delegation sections", () => {
    const result = generateInstructions("sisyphus", {})

    expect(result).toContain("Tool_Guidance")
    expect(result).toContain("Delegation_Rules")
    expect(result).toContain("delegate_task")
  })

  it("includes category routing section", () => {
    const result = generateInstructions("sisyphus", {})

    expect(result).toContain("Category")
    expect(result).toContain("quick")
    expect(result).toContain("deep")
    expect(result).toContain("ultrabrain")
  })

  it("unknown agent uses dynamic tool guidance with disabled tools", () => {
    const result = generateInstructions("nonexistent", {
      disabled_tools: ["lsp_rename", "grep"],
    })

    expect(result).toContain("MCP Tool")
    expect(result).toContain("disabled")
    expect(result).toContain("lsp_goto_definition")
  })

  it("appends prompt_append from agent config", () => {
    const result = generateInstructions("sisyphus", {
      agents: {
        sisyphus: {
          prompt_append: "CUSTOM INSTRUCTION: Always write tests first.",
        },
      },
    })

    expect(result).toContain("CUSTOM INSTRUCTION: Always write tests first.")
  })

  it("includes custom categories from config", () => {
    const result = generateInstructions("sisyphus", {
      categories: {
        frontend: { model: "gpt-5-nano", description: "UI/UX tasks" },
      },
    })

    expect(result).toContain("frontend")
    expect(result).toContain("gpt-5-nano")
    expect(result).toContain("UI/UX tasks")
  })

  it("truncates instructions exceeding 32KB with warning", () => {
    const hugeAppend = "X".repeat(40000)
    const result = generateInstructions("sisyphus", {
      agents: {
        sisyphus: {
          prompt_append: hugeAppend,
        },
      },
    })

    const byteLength = new TextEncoder().encode(result).length
    expect(byteLength).toBeLessThanOrEqual(MAX_BYTES)
    expect(result).toContain("[WARNING]")
    expect(result).toContain("truncated")
  })
})
