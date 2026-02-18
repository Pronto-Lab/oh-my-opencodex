import type { EventPayload, OhMyOpenCodexEvent } from "../orchestrator/types"

export type HookRegistration<E extends OhMyOpenCodexEvent = OhMyOpenCodexEvent> = {
  event: E
  handler: (payload: EventPayload[E]) => Promise<void>
  priority: number
}
