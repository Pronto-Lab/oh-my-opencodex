import { executeCommand } from "../../shared/command-executor"
import type { TmuxPane } from "./types"

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function hasCommandError(output: string): boolean {
  return output.includes("[stderr:")
}

function createThreadId(): string {
  return `thread-${Date.now().toString(36)}`
}

function parseThreadId(title: string, fallback: string): string {
  const match = /\[(thread-[^\]]+)\]/.exec(title)
  if (match?.[1]) {
    return match[1]
  }

  return fallback.replace(/^%/, "pane-")
}

export async function createPane(session: string, title: string): Promise<TmuxPane | null> {
  const paneIdOutput = await executeCommand(
    `tmux split-window -P -F '#{pane_id}' -t ${quote(`${session}:`)}`,
  )

  if (hasCommandError(paneIdOutput)) {
    return null
  }

  const paneId = paneIdOutput.trim()
  const threadId = createThreadId()
  const paneTitle = `${title} [${threadId}]`
  await executeCommand(`tmux select-pane -t ${quote(paneId)} -T ${quote(paneTitle)}`)

  return {
    id: paneId,
    title: paneTitle,
    threadId,
  }
}

export async function destroyPane(paneId: string): Promise<boolean> {
  const output = await executeCommand(`tmux kill-pane -t ${quote(paneId)}`)
  return !hasCommandError(output)
}

export async function listPanes(session: string): Promise<TmuxPane[]> {
  const output = await executeCommand(
    `tmux list-panes -t ${quote(session)} -F '#{pane_id}\t#{pane_title}'`,
  )

  if (hasCommandError(output) || output.length === 0) {
    return []
  }

  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [id = "", title = ""] = line.split("\t")
      return {
        id,
        title,
        threadId: parseThreadId(title, id),
      }
    })
}
