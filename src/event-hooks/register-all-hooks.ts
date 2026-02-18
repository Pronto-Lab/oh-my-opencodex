import type { OhMyCodexConfig } from "../config/schema/oh-my-codex-config"
import type { HookRegistry } from "./hook-registry"

export function registerAllHooks(
  registry: HookRegistry,
  config: OhMyCodexConfig,
): void {
  void registry
  void config

  // Hooks will be registered here in Wave 5
  // T5.1: Turn hooks + session hooks (9)
  // T5.2: Item hooks (4)
  // T5.3: Continuation hooks (5)
  // T5.4: Skill hooks (2)
}
