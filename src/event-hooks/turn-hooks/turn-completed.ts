import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

const cumulativeUsage = {
  turns: 0,
  input_tokens: 0,
  output_tokens: 0,
}

export function createTurnCompletedHook(
  _config: OhMyCodexConfig,
): HookRegistration<"turn:completed"> {
  return {
    event: "turn:completed",
    priority: 110,
    handler: async ({ usage }) => {
      cumulativeUsage.turns += 1

      if (usage === null) {
        log("[turn-completed] turn completed without usage", {
          turns: cumulativeUsage.turns,
        })
        return
      }

      cumulativeUsage.input_tokens += usage.input_tokens
      cumulativeUsage.output_tokens += usage.output_tokens

      log("[turn-completed] turn completed", {
        turn: cumulativeUsage.turns,
        usage,
        cumulative: {
          input_tokens: cumulativeUsage.input_tokens,
          output_tokens: cumulativeUsage.output_tokens,
        },
      })
    },
  }
}
