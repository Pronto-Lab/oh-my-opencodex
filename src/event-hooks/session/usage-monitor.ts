import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

const WARNING_THRESHOLD_TOKENS = 200_000

const usageState = {
  input_tokens: 0,
  output_tokens: 0,
  warned: false,
}

export function createUsageMonitorHook(
  _config: OhMyOpenCodexConfig,
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
      const total = usageState.input_tokens + usageState.output_tokens

      if (total >= WARNING_THRESHOLD_TOKENS && !usageState.warned) {
        usageState.warned = true
        log("[usage-monitor] high cumulative token usage", {
          total: total,
          threshold: WARNING_THRESHOLD_TOKENS,
        })
      }
    },
  }
}
