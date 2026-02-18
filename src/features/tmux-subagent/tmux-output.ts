import { executeCommand } from "../../shared/command-executor"

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function hasCommandError(output: string): boolean {
  return output.includes("[stderr:")
}

export async function captureOutput(paneId: string): Promise<string> {
  const output = await executeCommand(`tmux capture-pane -p -t ${quote(paneId)}`)
  if (hasCommandError(output)) {
    return ""
  }

  return output
}

export async function sendCommand(paneId: string, cmd: string): Promise<boolean> {
  const output = await executeCommand(
    `tmux send-keys -t ${quote(paneId)} -l ${quote(cmd)} && tmux send-keys -t ${quote(paneId)} Enter`,
  )

  return !hasCommandError(output)
}
