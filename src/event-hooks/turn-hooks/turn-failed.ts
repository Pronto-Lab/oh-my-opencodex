import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

type FailureClass = "transient" | "permanent"

const transientPatterns = [
  /rate\s*limit/i,
  /timeout/i,
  /temporar/i,
  /503\b/i,
  /econnreset/i,
]

function classifyFailure(error: string): FailureClass {
  return transientPatterns.some((pattern) => pattern.test(error))
    ? "transient"
    : "permanent"
}

export function createTurnFailedHook(
  _config: OhMyOpenCodexConfig,
): HookRegistration<"turn:failed"> {
  return {
    event: "turn:failed",
    priority: 120,
    handler: async ({ error }) => {
      const failureClass = classifyFailure(error)

      log("[turn-failed] turn failed", {
        error,
        failureClass,
      })
    },
  }
}
