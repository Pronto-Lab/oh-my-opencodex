import { readFile } from "node:fs/promises"
import type { OhMyCodexConfig } from "../../config/schema/oh-my-codex-config"
import { log } from "../../shared/logger"
import type { HookRegistration } from "../hook-registration"

type VersionResponse = { version?: unknown }

let checkedForUpdate = false

function toVersionParts(version: string): number[] {
  return version
    .split("-")[0]
    .split(".")
    .map((segment) => Number.parseInt(segment, 10) || 0)
}

function isNewerVersion(current: string, latest: string): boolean {
  const currentParts = toVersionParts(current)
  const latestParts = toVersionParts(latest)
  const maxLen = Math.max(currentParts.length, latestParts.length)

  for (let i = 0; i < maxLen; i += 1) {
    const left = currentParts[i] ?? 0
    const right = latestParts[i] ?? 0
    if (right > left) return true
    if (right < left) return false
  }

  return false
}

async function getLocalVersion(): Promise<string | null> {
  try {
    const raw = await readFile(new URL("../../../package.json", import.meta.url), "utf8")
    const parsed = JSON.parse(raw) as VersionResponse
    return typeof parsed.version === "string" ? parsed.version : null
  } catch {
    return null
  }
}

export function createAutoUpdateCheckerHook(
  _config: OhMyCodexConfig,
): HookRegistration<"thread:started"> {
  return {
    event: "thread:started",
    priority: 200,
    handler: async () => {
      if (checkedForUpdate) {
        return
      }
      checkedForUpdate = true

      const localVersion = await getLocalVersion()
      if (localVersion === null) {
        return
      }

      try {
        const response = await fetch("https://registry.npmjs.org/oh-my-codex/latest")
        if (!response.ok) {
          return
        }
        const body = (await response.json()) as VersionResponse
        const latestVersion = typeof body.version === "string" ? body.version : null
        if (latestVersion === null) {
          return
        }

        if (isNewerVersion(localVersion, latestVersion)) {
          log("[auto-update-checker] newer version available", {
            localVersion,
            latestVersion,
          })
        }
      } catch (error) {
        log("[auto-update-checker] failed to check updates", error)
      }
    },
  }
}
