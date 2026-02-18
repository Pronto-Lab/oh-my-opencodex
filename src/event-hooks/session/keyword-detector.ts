import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { ThreadItem } from "../../orchestrator/types"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

function extractItemText(item: ThreadItem): string {
  if (typeof item.text === "string") {
    return item.text
  }

  const message = item.message
  if (typeof message === "string") {
    return message
  }

  const prompt = item.prompt
  if (typeof prompt === "string") {
    return prompt
  }

  return ""
}

function ensureReasoningEffort(config: OhMyOpenCodexConfig): void {
  const agentName = config.default_agent ?? "sisyphus"

  if (config.agents === undefined) {
    config.agents = {}
  }

  const current = config.agents[agentName] ?? {}
  const effort = current.reasoning_effort

  if (effort === "high" || effort === "xhigh") {
    return
  }

  config.agents[agentName] = {
    ...current,
    reasoning_effort: "high",
  }

  log("[keyword-detector] ultrawork keyword detected, reasoning raised", {
    agent: agentName,
    reasoning: "high",
  })
}

export function createKeywordDetectorHook(
  config: OhMyOpenCodexConfig,
): HookRegistration<"item:completed"> {
  return {
    event: "item:completed",
    priority: 280,
    handler: async ({ item }) => {
      const text = extractItemText(item)
      if (!/\b(ultrawork|ulw)\b/i.test(text)) {
        return
      }

      ensureReasoningEffort(config)
    },
  }
}
