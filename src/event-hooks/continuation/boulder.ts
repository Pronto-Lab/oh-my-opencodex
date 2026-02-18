import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { HookRegistry } from "../hook-registry"
import {
  clearBoulderState,
  createBoulderState,
  loadBoulderState,
  saveBoulderState,
} from "../../features/boulder-state"
import { todoListWatcher } from "../item-hooks/todo-list-watcher"

const HOOK_NAME = "boulder"
const BOULDER_PROMPT_PREFIX = "[TODO CONTINUATION]"

type IncompleteTodo = {
  content: string
  status: string
}

function getTodoPreview(incompleteTodos: IncompleteTodo[]): string {
  if (incompleteTodos.length === 0) {
    return ""
  }

  const preview = incompleteTodos
    .slice(0, 3)
    .map((todo) => `- ${todo.content}`)
    .join("\n")

  return `\n${preview}`
}

export function createBoulderHook(
  config: OhMyOpenCodexConfig,
  workingDir: string,
  registry: HookRegistry,
  getIncompleteTodos: () => IncompleteTodo[] = () =>
    todoListWatcher.getIncompleteTodos(),
): void {
  if (config.boulder?.enabled === false) {
    return
  }

  registry.registerContinuation(
    HOOK_NAME,
    () => {
      const incompleteTodos = getIncompleteTodos()

      if (incompleteTodos.length === 0) {
        clearBoulderState(workingDir)
        return { shouldContinue: false }
      }

      const loadedState = loadBoulderState(workingDir)
      const state = loadedState ?? createBoulderState()
      const maxRetries = config.boulder?.max_retries ?? state.maxRetries

      if (state.retryCount >= maxRetries) {
        clearBoulderState(workingDir)
        return { shouldContinue: false }
      }

      const nextState = {
        ...state,
        todos: incompleteTodos.map((todo) => ({
          content: todo.content,
          status: "pending" as const,
        })),
        maxRetries,
        retryCount: state.retryCount + 1,
        lastCheckedAt: new Date().toISOString(),
        isActive: true,
      }

      const saved = saveBoulderState(nextState, workingDir)
      if (!saved) {
        return { shouldContinue: false }
      }

      const continuationPrompt =
        `${BOULDER_PROMPT_PREFIX} Incomplete tasks remain ` +
        `(${incompleteTodos.length}). Continue until all todos are completed.` +
        getTodoPreview(incompleteTodos)

      return {
        shouldContinue: true,
        continuationPrompt,
      }
    },
    300,
  )
}
