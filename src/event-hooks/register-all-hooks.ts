import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import type { HookRegistry } from "./hook-registry"
import {
  createAutoUpdateCheckerHook,
  createKeywordDetectorHook,
  createNotificationHook,
  createSessionRecoveryHook,
  createThinkModeHook,
  createUsageMonitorHook,
} from "./session"
import {
  createTurnCompletedHook,
  createTurnFailedHook,
  createTurnStartedHook,
} from "./turn-hooks"

export function registerAllHooks(
  registry: HookRegistry,
  config: OhMyCodexConfig,
): void {
  const turnStarted = createTurnStartedHook(config)
  const turnCompleted = createTurnCompletedHook(config)
  const turnFailed = createTurnFailedHook(config)

  const sessionRecovery = createSessionRecoveryHook(config)
  const usageMonitor = createUsageMonitorHook(config)
  const notification = createNotificationHook(config)
  const autoUpdateChecker = createAutoUpdateCheckerHook(config)
  const keywordDetector = createKeywordDetectorHook(config)
  const thinkMode = createThinkModeHook(config)

  registry.register(
    "turn-started-hook",
    turnStarted.event,
    turnStarted.handler,
    turnStarted.priority,
  )
  registry.register(
    "turn-completed-hook",
    turnCompleted.event,
    turnCompleted.handler,
    turnCompleted.priority,
  )
  registry.register(
    "turn-failed-hook",
    turnFailed.event,
    turnFailed.handler,
    turnFailed.priority,
  )

  registry.register(
    "session-recovery-hook",
    sessionRecovery.event,
    sessionRecovery.handler,
    sessionRecovery.priority,
  )
  registry.register(
    "usage-monitor-hook",
    usageMonitor.event,
    usageMonitor.handler,
    usageMonitor.priority,
  )
  registry.register(
    "notification-hook",
    notification.event,
    notification.handler,
    notification.priority,
  )
  registry.register(
    "auto-update-checker-hook",
    autoUpdateChecker.event,
    autoUpdateChecker.handler,
    autoUpdateChecker.priority,
  )
  registry.register(
    "keyword-detector-hook",
    keywordDetector.event,
    keywordDetector.handler,
    keywordDetector.priority,
  )
  registry.register(
    "think-mode-hook",
    thinkMode.event,
    thinkMode.handler,
    thinkMode.priority,
  )
}
