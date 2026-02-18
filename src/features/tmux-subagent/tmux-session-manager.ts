import { executeCommand } from "../../shared/command-executor"
import { DEFAULT_TMUX_CONFIG, type TmuxConfig } from "./types"

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function hasCommandError(output: string): boolean {
  return output.includes("[stderr:")
}

export class TmuxSessionManager {
  private readonly config: TmuxConfig

  constructor(config: Partial<TmuxConfig> = {}) {
    this.config = { ...DEFAULT_TMUX_CONFIG, ...config }
  }

  async createSession(name: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    const sessionName = this.resolveSessionName(name)
    if (await this.isSessionActive(name)) {
      return true
    }

    const output = await executeCommand(`tmux new-session -d -s ${quote(sessionName)}`)
    return !hasCommandError(output)
  }

  async destroySession(name: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    const sessionName = this.resolveSessionName(name)
    if (!(await this.isSessionActive(name))) {
      return true
    }

    const output = await executeCommand(`tmux kill-session -t ${quote(sessionName)}`)
    return !hasCommandError(output)
  }

  async isSessionActive(name: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    const sessionName = this.resolveSessionName(name)
    const output = await executeCommand(`tmux has-session -t ${quote(sessionName)}`)
    return !hasCommandError(output)
  }

  private resolveSessionName(name: string): string {
    const prefix = this.config.sessionPrefix?.trim()
    if (!prefix) {
      return name
    }

    return `${prefix}-${name}`
  }
}
