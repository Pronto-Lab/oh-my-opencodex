import { describe, expect, test } from "vitest"
import {
  createSisyphusAgent,
  getSisyphusPromptSource,
} from "./sisyphus"

describe("getSisyphusPromptSource", () => {
  test("returns gpt for OpenAI GPT models", () => {
    expect(getSisyphusPromptSource("openai/gpt-5.2")).toBe("gpt")
  })

  test("returns default for non-GPT models", () => {
    expect(getSisyphusPromptSource("anthropic/claude-opus-4-6")).toBe(
      "default",
    )
  })
})

describe("createSisyphusAgent prompt source", () => {
  test("injects GPT optimization block for GPT models", () => {
    const agent = createSisyphusAgent("openai/gpt-5.2")
    expect(agent.prompt).toContain("<GPT_5_2_OPTIMIZATION>")
  })

  test("does not inject GPT optimization block for non-GPT models", () => {
    const agent = createSisyphusAgent("anthropic/claude-opus-4-6")
    expect(agent.prompt).not.toContain("<GPT_5_2_OPTIMIZATION>")
  })
})
