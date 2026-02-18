import { log } from "../shared/logger"
import type {
  ContinuationResult,
  EventPayload,
  OhMyCodexEvent,
} from "../orchestrator/types"

type HookHandler<E extends OhMyCodexEvent> = (
  payload: EventPayload[E],
) => void | Promise<void>

type ContinuationHandler = (
  payload: EventPayload["turn:completed"],
) => ContinuationResult | Promise<ContinuationResult>

type RegisteredHook = {
  event: OhMyCodexEvent
  name: string
  priority: number
  handler: HookHandler<any>
}

type RegisteredContinuationHook = {
  name: string
  priority: number
  handler: ContinuationHandler
}

export class HookRegistry {
  private hooks = new Map<OhMyCodexEvent, RegisteredHook[]>()
  private continuationHooks: RegisteredContinuationHook[] = []
  private disabledHooks: Set<string>

  constructor(disabledHooks?: string[]) {
    this.disabledHooks = new Set(disabledHooks ?? [])
  }

  register<E extends OhMyCodexEvent>(
    name: string,
    event: E,
    handler: HookHandler<E>,
    priority = 100,
  ): void {
    if (this.disabledHooks.has(name)) {
      return
    }

    const hooks = this.hooks.get(event) ?? []
    hooks.push({ event, name, priority, handler })
    hooks.sort((a, b) => a.priority - b.priority)
    this.hooks.set(event, hooks)
  }

  registerContinuation(
    name: string,
    handler: ContinuationHandler,
    priority = 100,
  ): void {
    if (this.disabledHooks.has(name)) {
      return
    }

    this.continuationHooks.push({ name, priority, handler })
    this.continuationHooks.sort((a, b) => a.priority - b.priority)
  }

  async emit<E extends OhMyCodexEvent>(
    event: E,
    payload: EventPayload[E],
  ): Promise<void> {
    const hooks = this.hooks.get(event) ?? []

    for (const hook of hooks) {
      try {
        await hook.handler(payload)
      } catch (error) {
        log(`Hook ${hook.name} failed on ${event}`, error)
      }
    }
  }

  async checkContinuation(
    payload: EventPayload["turn:completed"],
  ): Promise<ContinuationResult> {
    for (const hook of this.continuationHooks) {
      try {
        const result = await hook.handler(payload)
        if (result.shouldContinue) {
          return result
        }
      } catch (error) {
        log(`Continuation hook ${hook.name} failed`, error)
      }
    }

    return { shouldContinue: false }
  }

  getRegisteredHooks(): string[] {
    const names = new Set<string>()

    for (const hooks of this.hooks.values()) {
      for (const hook of hooks) {
        names.add(hook.name)
      }
    }

    for (const hook of this.continuationHooks) {
      names.add(hook.name)
    }

    return Array.from(names)
  }
}
