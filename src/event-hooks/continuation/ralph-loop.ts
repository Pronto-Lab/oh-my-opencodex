import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { HookRegistry } from "../hook-registry"
import {
  clearContinuationState,
  loadContinuationState,
  saveContinuationState,
} from "../../features/run-continuation-state"

const HOOK_NAME = "ralph-loop"
const RALPH_PROMPT_PREFIX = "[RALPH LOOP]"

export function createRalphLoopHook(
  config: OhMyOpenCodexConfig,
  workingDir: string,
  registry: HookRegistry,
): void {
  if (config.ralph_loop?.enabled === false) {
    return
  }

  registry.registerContinuation(
    HOOK_NAME,
    () => {
      const state = loadContinuationState(workingDir)
      if (!state || !state.isRunning) {
        return { shouldContinue: false }
      }

      const maxIterations = config.ralph_loop?.max_iterations ?? state.maxIterations
      if (state.iterationCount >= maxIterations) {
        clearContinuationState(workingDir)
        return { shouldContinue: false }
      }

      const nextIteration = state.iterationCount + 1
      const saved = saveContinuationState(
        {
          ...state,
          maxIterations,
          iterationCount: nextIteration,
        },
        workingDir,
      )

      if (!saved) {
        return { shouldContinue: false }
      }

      return {
        shouldContinue: true,
        continuationPrompt:
          `${RALPH_PROMPT_PREFIX} Continue autonomous execution ` +
          `(${nextIteration}/${maxIterations}).`,
      }
    },
    400,
  )
}
