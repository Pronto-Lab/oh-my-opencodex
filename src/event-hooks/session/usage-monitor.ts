import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

const WARNING_THRESHOLD_TOKENS = 200_000

const usageState = {
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  warned: false,
}

export function createUsageMonitorHook(
  _config: OhMyCodexConfig,
): HookRegistration<"turn:completed"> {
  return {
    event: "turn:completed",
    priority: 250,
    handler: async ({ usage }) => {
      if (usage === null) {
        return
      }

      usageState.input_tokens += usage.input_tokens
      usageState.output_tokens += usage.output_tokens
      usageState.total_tokens += usage.total_tokens

      if (usageState.total_tokens >= WARNING_THRESHOLD_TOKENS && !usageState.warned) {
        usageState.warned = true
        log("[usage-monitor] high cumulative token usage", {
          total_tokens: usageState.total_tokens,
          threshold: WARNING_THRESHOLD_TOKENS,
        })
      }
    },
  }
}
