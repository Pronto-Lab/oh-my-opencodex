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

function setXHighReasoning(config: OhMyOpenCodexConfig): void {
  const agentName = config.default_agent ?? "sisyphus"

  if (config.agents === undefined) {
    config.agents = {}
  }

  config.agents[agentName] = {
    ...(config.agents[agentName] ?? {}),
    reasoning_effort: "xhigh",
  }

  log("[think-mode] ultrathink keyword detected, reasoning raised", {
    agent: agentName,
    reasoning: "xhigh",
  })
}

export function createThinkModeHook(
  config: OhMyOpenCodexConfig,
): HookRegistration<"item:completed"> {
  return {
    event: "item:completed",
    priority: 285,
    handler: async ({ item }) => {
      const text = extractItemText(item)
      if (!/\bultrathink\b/i.test(text)) {
        return
      }

      setXHighReasoning(config)
    },
  }
}
