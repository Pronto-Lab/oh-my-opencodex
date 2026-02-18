import { executeCommand } from "../../shared/command-executor"

let cachedTmuxPath: string | null = null

function isStderrOutput(output: string): boolean {
  return output.startsWith("[stderr:")
}

function normalizePathResult(output: string): string | null {
  const firstLine = output.trim().split("\n")[0]?.trim()
  if (!firstLine) {
    return null
  }
  if (firstLine.includes("not found")) {
    return null
  }
  return firstLine
}

export async function getTmuxPath(): Promise<string | null> {
  if (cachedTmuxPath !== null) {
    return cachedTmuxPath
  }

  const finder = process.platform === "win32" ? "where" : "which"
  const locationResult = await executeCommand(`${finder} tmux`)
  if (isStderrOutput(locationResult)) {
    return null
  }

  const tmuxPath = normalizePathResult(locationResult)
  if (!tmuxPath) {
    return null
  }

  const verifyResult = await executeCommand(`"${tmuxPath}" -V`)
  if (isStderrOutput(verifyResult)) {
    return null
  }

  cachedTmuxPath = tmuxPath
  return tmuxPath
}
