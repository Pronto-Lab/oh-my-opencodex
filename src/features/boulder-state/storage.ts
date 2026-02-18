import * as fs from "fs"
import * as path from "path"
import type { BoulderState } from "./types"
import { BOULDER_STATE_FILE, DEFAULT_MAX_RETRIES } from "./constants"

export function saveBoulderState(state: BoulderState, workingDir: string): boolean {
  try {
    const filePath = path.join(workingDir, BOULDER_STATE_FILE)
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

export function loadBoulderState(workingDir: string): BoulderState | null {
  try {
    const filePath = path.join(workingDir, BOULDER_STATE_FILE)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const content = fs.readFileSync(filePath, "utf-8")
    const parsed = JSON.parse(content)

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    return parsed as BoulderState
  } catch {
    return null
  }
}

export function clearBoulderState(workingDir: string): boolean {
  try {
    const filePath = path.join(workingDir, BOULDER_STATE_FILE)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    return true
  } catch {
    return false
  }
}

export function createBoulderState(): BoulderState {
  return {
    todos: [],
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
    lastCheckedAt: new Date().toISOString(),
    isActive: true,
  }
}
