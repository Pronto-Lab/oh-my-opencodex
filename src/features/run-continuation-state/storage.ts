import * as fs from "fs"
import * as path from "path"
import type { ContinuationState } from "./types"
import { CONTINUATION_STATE_FILE, DEFAULT_MAX_ITERATIONS } from "./constants"

export function saveContinuationState(state: ContinuationState, workingDir: string): boolean {
  try {
    const filePath = path.join(workingDir, CONTINUATION_STATE_FILE)
    const dir = path.dirname(filePath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8")
    return true
  } catch {
    return false
  }
}

export function loadContinuationState(workingDir: string): ContinuationState | null {
  try {
    const filePath = path.join(workingDir, CONTINUATION_STATE_FILE)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const content = fs.readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(content)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    return parsed as ContinuationState
  } catch {
    return null
  }
}

export function clearContinuationState(workingDir: string): boolean {
  try {
    const filePath = path.join(workingDir, CONTINUATION_STATE_FILE)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    return true
  } catch {
    return false
  }
}

export function createContinuationState(): ContinuationState {
  return {
    isRunning: true,
    iterationCount: 0,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    startedAt: new Date().toISOString(),
  }
}
