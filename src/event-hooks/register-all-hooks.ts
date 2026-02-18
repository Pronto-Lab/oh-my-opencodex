import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import type { HookRegistry } from "./hook-registry"
import {
  createBackgroundCompletedHook,
  createBoulderHook,
  createEmptyResponseDetectorHook,
  createRalphLoopHook,
  createStopGuardHook,
} from "./continuation"
import {
  createCommandWatcherHook,
  createFileChangeCheckerHook,
  createMcpToolWatcherHook,
  createTodoListWatcherHook,
} from "./item-hooks"
import {
  createAutoUpdateCheckerHook,
  createKeywordDetectorHook,
  createNotificationHook,
  createSessionRecoveryHook,
  createThinkModeHook,
  createUsageMonitorHook,
} from "./session"
import {
  createAutoSlashCommandHook,
  createCategorySkillReminderHook,
} from "./skill-hooks"
import {
  createTurnCompletedHook,
  createTurnFailedHook,
  createTurnStartedHook,
} from "./turn-hooks"

function isHookEnabled(disabledHooks: Set<string>, name: string): boolean {
  return !disabledHooks.has(name)
}

export function registerAllHooks(
  registry: HookRegistry,
  config: OhMyCodexConfig,
  workingDirectory: string,
): void {
  const disabledHooks = new Set(config.disabled_hooks ?? [])

  if (isHookEnabled(disabledHooks, "turn-started-hook")) {
    const hook = createTurnStartedHook(config)
    registry.register("turn-started-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "turn-completed-hook")) {
    const hook = createTurnCompletedHook(config)
    registry.register("turn-completed-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "turn-failed-hook")) {
    const hook = createTurnFailedHook(config)
    registry.register("turn-failed-hook", hook.event, hook.handler, hook.priority)
  }

  if (isHookEnabled(disabledHooks, "session-recovery-hook")) {
    const hook = createSessionRecoveryHook(config)
    registry.register("session-recovery-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "usage-monitor-hook")) {
    const hook = createUsageMonitorHook(config)
    registry.register("usage-monitor-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "notification-hook")) {
    const hook = createNotificationHook(config)
    registry.register("notification-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "auto-update-checker-hook")) {
    const hook = createAutoUpdateCheckerHook(config)
    registry.register("auto-update-checker-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "keyword-detector-hook")) {
    const hook = createKeywordDetectorHook(config)
    registry.register("keyword-detector-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "think-mode-hook")) {
    const hook = createThinkModeHook(config)
    registry.register("think-mode-hook", hook.event, hook.handler, hook.priority)
  }

  if (isHookEnabled(disabledHooks, "file-change-checker-hook")) {
    const hook = createFileChangeCheckerHook(config)
    registry.register("file-change-checker-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "todo-list-watcher-hook")) {
    const hook = createTodoListWatcherHook(config)
    registry.register("todo-list-watcher-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "command-watcher-hook")) {
    const hook = createCommandWatcherHook(config)
    registry.register("command-watcher-hook", hook.event, hook.handler, hook.priority)
  }
  if (isHookEnabled(disabledHooks, "mcp-tool-watcher-hook")) {
    const hook = createMcpToolWatcherHook(config)
    registry.register("mcp-tool-watcher-hook", hook.event, hook.handler, hook.priority)
  }

  if (isHookEnabled(disabledHooks, "stop-guard")) {
    createStopGuardHook(config, workingDirectory, registry)
  }
  if (isHookEnabled(disabledHooks, "empty-response-detector")) {
    createEmptyResponseDetectorHook(config, workingDirectory, registry)
  }
  if (isHookEnabled(disabledHooks, "background-completed")) {
    createBackgroundCompletedHook(config, workingDirectory, registry)
  }
  if (isHookEnabled(disabledHooks, "boulder")) {
    createBoulderHook(config, workingDirectory, registry)
  }
  if (isHookEnabled(disabledHooks, "ralph-loop")) {
    createRalphLoopHook(config, workingDirectory, registry)
  }

  if (isHookEnabled(disabledHooks, "category-skill-reminder")) {
    createCategorySkillReminderHook(config, registry)
  }
  if (isHookEnabled(disabledHooks, "auto-slash-command")) {
    createAutoSlashCommandHook(config, registry)
  }
}
