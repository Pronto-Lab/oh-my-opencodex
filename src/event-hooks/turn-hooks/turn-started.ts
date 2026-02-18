import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

let turnCounter = 0
let lastTurnStartedAt = 0

export function createTurnStartedHook(
  _config: OhMyCodexConfig,
): HookRegistration<"turn:started"> {
  return {
    event: "turn:started",
    priority: 100,
    handler: async () => {
      turnCounter += 1
      lastTurnStartedAt = Date.now()

      log("[turn-started] turn started", {
        turn: turnCounter,
        startedAt: lastTurnStartedAt,
      })
    },
  }
}
