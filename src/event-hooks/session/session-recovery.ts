import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

const transientPatterns = [
  /rate\s*limit/i,
  /timeout/i,
  /temporar/i,
  /503\b/i,
  /econnreset/i,
]

function isTransientError(error: string): boolean {
  return transientPatterns.some((pattern) => pattern.test(error))
}

let consecutiveFailures = 0
let retryAttempts = 0

export function createSessionRecoveryHook(
  config: OhMyCodexConfig,
): HookRegistration<"turn:failed"> {
  const maxRetries = Math.max(1, config.boulder?.max_retries ?? 3)

  return {
    event: "turn:failed",
    priority: 300,
    handler: async ({ error }) => {
      consecutiveFailures += 1

      if (!isTransientError(error)) {
        retryAttempts = 0
        log("[session-recovery] permanent failure detected, skipping retry", {
          error,
          consecutiveFailures,
        })
        return
      }

      if (retryAttempts >= maxRetries) {
        log("[session-recovery] transient failure retry limit reached", {
          error,
          maxRetries,
          consecutiveFailures,
        })
        return
      }

      retryAttempts += 1

      log("[session-recovery] transient failure detected, scheduling retry", {
        error,
        retryAttempts,
        maxRetries,
      })
    },
  }
}
