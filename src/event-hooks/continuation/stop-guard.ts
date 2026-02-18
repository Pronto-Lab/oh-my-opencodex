import * as fs from "fs"
import * as path from "path"
import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import type { HookRegistry } from "../hook-registry"
import { clearBoulderState } from "../../features/boulder-state"
import { clearContinuationState } from "../../features/run-continuation-state"

const HOOK_NAME = "stop-guard"
const STOP_FILE_NAME = ".codex/stop-continuation.flag"
const STOP_PATTERN = /(^|\s)\/stop(?:-continuation)?\b/i

let stopRequested = false

function hasStopCommand(input: unknown): boolean {
  if (typeof input === "string") {
    return STOP_PATTERN.test(input)
  }

  if (!input || typeof input !== "object") {
    return false
  }

  const values = Object.values(input)
  for (const value of values) {
    if (hasStopCommand(value)) {
      return true
    }
  }

  return false
}

function stopFilePath(workingDir: string): string {
  return path.join(workingDir, STOP_FILE_NAME)
}

function isStopFileSet(workingDir: string): boolean {
  return fs.existsSync(stopFilePath(workingDir))
}

function clearStopFile(workingDir: string): void {
  const flagPath = stopFilePath(workingDir)
  if (fs.existsSync(flagPath)) {
    fs.unlinkSync(flagPath)
  }
}

export function requestStopContinuation(): void {
  stopRequested = true
}

export function createStopGuardHook(
  _config: OhMyCodexConfig,
  workingDir: string,
  registry: HookRegistry,
): void {
  registry.register(
    HOOK_NAME,
    "turn:started",
    (payload) => {
      if (stopRequested || isStopFileSet(workingDir) || hasStopCommand(payload)) {
        stopRequested = true
      }
    },
    0,
  )

  registry.registerContinuation(
    HOOK_NAME,
    () => {
      if (!stopRequested && !isStopFileSet(workingDir)) {
        return { shouldContinue: false }
      }

      clearBoulderState(workingDir)
      clearContinuationState(workingDir)
      clearStopFile(workingDir)
      stopRequested = false

      return { shouldContinue: false }
    },
    0,
  )
}
