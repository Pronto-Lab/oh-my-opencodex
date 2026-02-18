import type { EventPayload, OhMyCodexEvent } from "../orchestrator/types"

export type HookRegistration<E extends OhMyCodexEvent = OhMyCodexEvent> = {
  event: E
  handler: (payload: EventPayload[E]) => Promise<void>
  priority: number
}
