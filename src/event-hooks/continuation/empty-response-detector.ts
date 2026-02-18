import type { OhMyOpenCodexConfig } from "../../config/schema/oh-my-opencodex-config"
import type { EventPayload } from "../../orchestrator/types"
import type { HookRegistry } from "../hook-registry"

const HOOK_NAME = "empty-response-detector"
const EMPTY_RESPONSE_LIMIT = 50
const MAX_RETRIES = 1

let latestResponseText = ""
let retryCount = 0

function getAgentMessageText(item: EventPayload["item:completed"]["item"]): string {
  if (typeof item.text === "string") {
    return item.text
  }

  const content = item.content
  if (typeof content === "string") {
    return content
  }

  if (!Array.isArray(content)) {
    return ""
  }

  const texts: string[] = []
  for (const chunk of content) {
    if (!chunk || typeof chunk !== "object") {
      continue
    }

    const maybeText = (chunk as { text?: unknown }).text
    if (typeof maybeText === "string") {
      texts.push(maybeText)
    }
  }

  return texts.join("")
}

export function createEmptyResponseDetectorHook(
  _config: OhMyOpenCodexConfig,
  _workingDir: string,
  registry: HookRegistry,
): void {
  registry.register(
    HOOK_NAME,
    "turn:started",
    () => {
      latestResponseText = ""
    },
    90,
  )

  registry.register(
    HOOK_NAME,
    "item:completed",
    (payload) => {
      if (payload.item.type !== "agent_message") {
        return
      }

      latestResponseText += getAgentMessageText(payload.item)
    },
    90,
  )

  registry.registerContinuation(
    HOOK_NAME,
    () => {
      const responseLength = latestResponseText.trim().length
      const isTooShort = responseLength < EMPTY_RESPONSE_LIMIT
      if (!isTooShort) {
        retryCount = 0
        return { shouldContinue: false }
      }

      if (retryCount >= MAX_RETRIES) {
        retryCount = 0
        return { shouldContinue: false }
      }

      retryCount += 1
      return {
        shouldContinue: true,
        continuationPrompt:
          "Your previous response was empty. Please try again with a complete answer.",
      }
    },
    100,
  )
}
